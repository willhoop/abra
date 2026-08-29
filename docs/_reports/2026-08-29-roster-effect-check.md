# The roster's move rows passed on the announcement. They now ask what happened.

MEASURE, 2026-08-29. Historical findings record. Not current state; superseded by whatever
`node engine/status.js` prints.

---

## Provenance

| what | value |
|---|---|
| engine release | `4b67526d29d8` (the cut carrying the redirection fix) |
| census the selector read | digest `6e73727d06ce`, **788 rows**, generated 2026-08-29T07:12:06Z, *identical to the live census* |
| tree | HEAD `03c61fc2`, working tree CLEAN at the start of the pass |
| baseline artifact | `data/all-mechanics-fire.json` digest `acb84bbf62ad` — read as the HEAD blob, then digest-checked equal to the live file. Byte-identical to what the leaf-coverage audit read. |
| new artifacts | `data/verification/all-mechanics-fire.leafeffect.json` (500 rows, 617 games, generated 07:54:54Z) and `…leafeffect-smoke.json` (19 rows). **The published `data/all-mechanics-fire.json` was NOT touched.** |

Two notes on the pins the coordinator handed me:

- **The census pin does not apply to this instrument.** `engine/all_mechanics_fire.js` contains no
  read of `data/mechanics-census.json` and no `--team-store` flag; its population is the format's
  legal move list and its carriers come from the dex. The census *does* steer the driver's sample
  selection, and the run printed the digest it used — `6e73727d06ce`, not the `9446a684709d` I was
  given. **I did not resolve that discrepancy and it is owed.** The census was identical to the live
  file at run time, which is the check that mattered here.
- ENGINE was mid-write when the pass began, so `data/all-mechanics-fire.json`,
  `data/mechanics-census.json` and `data/tags.json` were read via `git show HEAD:` and then
  digest-checked against the live files. All three matched.

---

## 1. The claim, verified — and it is overstated on two rows out of eleven

The audit said: *for eleven of the 24 uncomparable leaves, the roster's `RESOLVED` verdict is earned
by the line being printed rather than by anything happening.*

**Every named mechanism holds. The eleven-row count does not.**

| the audit's claim | verdict |
|---|---|
| `-singleturn` is not in `NOT_A_CONSEQUENCE`, so the announcement counts as a consequence | **TRUE** — read at `all_mechanics_fire.js`; the set is `-anim -hitcount -waiting -center -notarget -message -hint -ohko -combine -nothing`, and `verdictFor` counts any other `-` event |
| the move ladder stops at the first resolving rung, which for all of them is `bare` | **TRUE** — all eleven rows in the baseline artifact carry `rung: "bare"`, `turns: 1`, `rung_attempts: [{bare, resolved:true}]` |
| the receiver clicks `inert`, so nothing attacks into the shield | **TRUE** — `scriptFor`'s click turn is `T(click, {m: foe})` with `foe = inert` unless `receiverAttacks`/`receiverPriority` is set, and `inert = clickOf(receiver, ['Agility',…])` resolves to **Agility** on the Feraligatr receiver. `TRAILING` defaults to 0, so the script is one turn long |
| `VOLATILE_THEN_WHAT` is called at one site, inside the ability ladder | **TRUE** — `thenWhatFor` had exactly one caller |
| `moves rows with then_what: 0` | **TRUE** — moves 0, items 0, abilities 18, over 500/148/316 rows |
| **RESOLVED is earned by the announcement alone, for eleven leaves** | **TRUE FOR NINE. FALSE FOR TWO.** |

**Focus Punch and Beak Blast do not resolve on the announcement.** Both are attacking moves
(150 BP and 120 BP), so their segment carries `-damage`. And their `-singleturn` is emitted by
`priorityChargeCallback` at the *top of the turn*, before the `|move|` line — so it is not even
inside the segment `verdictFor` reads. Their `RESOLVED` is earned by damage.

**The systemic finding survives intact and is the part worth keeping.** For all eleven, the roster
covered the leaf's *creation* and not its *function*. Focus Punch's cancel and Beak Blast's burn
were as unexercised as Protect's block; they were simply credited for a different reason.

---

## 2. What was built

### `-singleturn` stays OUT of `NOT_A_CONSEQUENCE`, and the reason is now in the code

Two mechanisms, both stated at the declaration site:

1. **It is not bookkeeping.** Everything else in that set is the client being told how to draw a
   frame. `-singleturn` is the authority announcing that a state was created, and for a move whose
   entire function is to create a state, creating one *is* resolving. Demoting it makes Protect
   report *"the move executed and produced no consequence line at all"* — a false accusation against
   a correct engine, which is the shape that made 162 of 169 roster accusations turn out to be the
   ruler.
2. **It would single out one spelling of arrival.** `-start`, `-sidestart`, `-fieldstart` and
   `-singlemove` say the same thing for a longer-lived leaf and are legitimate consequences for
   Tailwind, Substitute, Trick Room and Encore. A set holding `-singleturn` and not those four is
   inconsistent by construction; one holding all five stops crediting every state-setting move in the
   format.

The gap was never that the announcement is counted. It is that **nothing separately asked whether the
leaf's effect ran.** That is a second field, not a redefinition of the first.

### The effect check — derived from the authority, and narrowed once after it over-matched

`leafEffectMarkers(moveId)` in `engine/all_mechanics_fire.js`. For a move that writes a leaf, split
the leaf's own handlers into ARRIVAL (`onStart` / `onSideStart` / `onFieldStart` / `onRestart`) and
INTERCEPTION (the `onTryHit` / `onHit` / `onDamage` / `onTryPrimaryHit` family — handlers that can
only run because an incoming move reached the leaf). Anything an interception handler prints is an
**effect marker**.

**Printed before wiring, as the rule requires, and the first version was noise.** Rule 1 — *any event
a non-arrival handler emits* — matched **60 of 500 moves**, and 41 of the marker instances were
`-end` / `-sideend` / `-fieldend` off `onEnd`, which is the leaf **expiring** rather than working
(Tailwind, Encore, Taunt, Torment, Trick Room). A one-turn script can never see one, so 41 would have
gone red for the fixture's length. Substitute and Shed Tail added `-fail` / `-ohko` off their own
already-have-one refusal path.

Narrowed to interception handlers, the match is **11 of 500** — the eight shields, plus Substitute,
Shed Tail and Psychic Terrain. Nothing else moves. The same rule over the other populations reaches
**32 abilities and 1 item** for free.

### The anchor was wrong first, and the instrument caught it before the engine did

The first anchor asked for the leaf's **display name** on the marker line. Showdown does not print
it. It announces the whole shield family under the generic label:

```
|move|p1a: Toxapex|Baneful Bunker|p1a: Toxapex
|-singleturn|p1a: Toxapex|move: Protect        <- not "move: Baneful Bunker"
|move|p2a: Feraligatr|Aerial Ace|p1a: Toxapex
|-activate|p1a: Toxapex|move: Protect          <- the block, also under Protect's name
|-status|p2a: Feraligatr|psn                   <- the Bunker's own punish
```

So the first run reported Spiky Shield, King's Shield and Baneful Bunker as ANNOUNCEMENT-ONLY on a
turn where the block had plainly happened and the poison was on the board. **Three of the seven reds
in the first run were the ruler.** The anchor is now the **literal third argument of the handler's own
`this.add`**, read out of the authority's source — so a leaf that changes how it announces itself is
followed rather than missed. The slot/side anchor is kept beside it and is not redundant: both ally
pads click Protect every turn, so `-activate … move: Protect` appears in this fixture for reasons that
have nothing to do with the subject.

Markers with **no literal label** are dropped (Substitute's and Shed Tail's `-fail` / `-ohko`). An
unanchored marker is worse than no marker — it turns green on the wrong line.

### `VOLATILE_THEN_WHAT` is now called from the move ladder, and it had never fired anywhere

Measured against `data/tags.json`:

|  | entries | `thenWhatFor` non-null | reached **by a volatile key** |
|---|---:|---:|---:|
| abilities (the only arm that called it) | 201 | 18 | **0** |
| items | 148 | 1 | **0** |
| moves (never called it) | 500 | 32 | **7** |

All seven keys of `VOLATILE_THEN_WHAT` are volatiles written by **moves**. Cute Charm — the one
ability that infatuates — is tagged `punishesAttacker` with no `statusInflict` param at all. **The
whole volatile half of `thenWhatFor` was dead: seven entries wired to the one arm where none of their
keys exist**, producing no error and no zero counter, because `THEN_WHAT_SEEN.rows: 64` was entirely
the tag-keyed table. An unwired knob gives identical output.

`setupFor` now calls the same producer. Verbs the move arm cannot execute are **counted, not dropped**:
the run prints `37 consequence verb(s) the shared table names and the MOVE arm cannot execute:
{"attacksAfter":13,"foeClicksAfter":7,"itemsOnBoth":3,…}`. Those belong to the ability gauntlet's
vocabulary — it builds its consequence turns *after* the switch, which a `duration: 1` leaf cannot
survive.

### The receiver no longer clicks `inert` on a rung whose point is a refusal

New consequence verb `attackedOnTheSameTurn`, because every other entry in `engine/faces.js` stages a
**later** turn and these leaves have none. Four tag keys, **match sets printed before wiring, zero
over-match**: `shieldsUser` → 5, `oneTurnGuard` → 2, `preTurnShield` → 2, `survivesAnyHit` → 1. Ten
rows, nothing else touched. The volatile table cannot reach four of them: Quick Guard and Wide Guard
write a side condition and Focus Punch and Beak Blast a pre-turn one, so none carries a
`statusInflict` param to key on.

The hit's **shape** is derived from the leaf's own guard, never from a move name — Quick Guard's
`onTryHit` opens `if (move.priority <= 0.1) return`, Wide Guard's tests `move.target`, and the target
names are pulled out of the guard's own text. *(The unit test caught that Wide Guard's first clause is
written `move?.target`, which the first regex missed and which would have silently halved the
derivation.)*

Ladder stop rule: **resolved AND the declared effect was seen.** For the 489 rows that declare no
marker `effectSettled` is always true and the rule is byte-identical to the old one. It can only ever
make a row play *more* boards, never fewer.

---

## 3. The numbers, over all 500 move rows

```
LEAF EFFECT — 11 row(s) write a leaf that PRINTS when it refuses something;
              7 of those had the effect on the board,
              4 resolved on the ANNOUNCEMENT alone.
  consequence table: 41 move row(s) carry a key, same-turn adversary asked for 10 and staged on 7;
                     76 leaf(s) print nothing when they fire and belong to a counter.
```

**Rows that changed verdict: ZERO.** Diffed row-by-row against the baseline artifact on
`resolved`, `medicham_resolved`, `diverged`, `rung`, `turns` and `board.verdict`:

| | baseline `acb84bbf62ad` | this run |
|---|---:|---:|
| resolved | 495 | 495 |
| diverged | 4 | 4 |
| resolution_disagreements | 11 | 11 |
| cannot_fire_in_this_fixture | 1 | 1 |
| **rows differing on any of the six fields** | — | **0** |

### The four still ANNOUNCEMENT-ONLY, each with its reason on the row

| row | why |
|---|---|
| `endure` | the shape is `lethal`, and **no hit in this fixture is lethal** — every body is at x6 HP by design so nothing faints. Counted as `shapeUnbuildable: {"lethal": 1}`. **A fixture limit, not an engine finding.** |
| `substitute`, `shedtail`, `psychicterrain` | the consequence table names no same-turn adversary for these three. They are **outside the 24 uncomparable leaves** (a Substitute's HP is a leaf the board already compares) and were left alone deliberately rather than widening the fixture change past the brief. |

### The seven that now check an effect — and no engine split

| row | shape staged | receiver clicked | Showdown | medicham2 |
|---|---|---|---|---|
| `protect` | physical | Facade | seen | seen |
| `detect` | physical | Facade | seen | seen |
| `spikyshield` | contact | Aerial Ace | seen | seen |
| `kingsshield` | contact | Aerial Ace | seen | seen |
| `banefulbunker` | contact | Aerial Ace | seen | seen |
| `quickguard` | guardShape → priority | Aqua Jet | seen | seen |
| `wideguard` | guardShape → spread | Blizzard | seen | seen |

`leafEffectSplit: {}` — **no row where one engine blocked and the other did not.** Both engines print
`|-activate|p1a: …|move: Protect` identically.

### One row is a declared conflict and cannot be had both ways

`focuspunch` declares both a same-turn consequence and `receiverMustNotAttack`. Its leaf's whole
function is being cancelled by a hit, so **the board that exercises the leaf is exactly the board on
which the move is refused.** Staging the hit anyway would turn a correct RESOLVED row into
`cant: Focus Punch` and read as an engine defect. `receiverIdle` wins, the conflict is recorded on the
row, and it needs **two rows on two boards** — a fixture this arm does not have. Beak Blast is *not*
in this case (a contact hit burns the attacker and the blast still fires) and is staged normally.

### Rows that flipped RED

**None.** Not one row went from RESOLVED to unresolved, and no engine defect was found by the effect
check. What changed is that seven rows now *prove* the shield blocked, four say plainly that they do
not, and 76 more say the question cannot be asked of them at all. The audit expected reds; the honest
answer is that the reds it predicted were half instrument (the anchor) and half already correct.

---

## 4. Two things the effect check does NOT cover, stated so a zero is readable

**It cannot see a silent effect, and 76 of the 500 move rows have one.** Three of the audit's eleven
are in that set and are dropped correctly:

- **Focus Punch** — its cancel prints `|cant|` from `beforeMoveCallback` on the *move*, not from a
  handler on the condition, so the marker is not on the leaf.
- **Beak Blast** — its burn is `source.trySetStatus('brn')`; the handler prints nothing of its own.
- **Electrify** — `onModifyType` calls `this.debug` and prints nothing at all.

They are recorded as `declares_no_marker`, not passed silently. **A leaf with no observable effect and
a leaf whose effect was never staged must not read alike.**

**Follow Me and Rage Powder are in that 76.** The redirection fix that landed tonight does not change
anything here, because the redirect is silent on the protocol and this check never claimed to cover it.

**Wide Guard's `-activate` was confirmed on the FOE's spread move only.** The filed defect — *Wide
Guard does nothing against the user's own ally's spread move*, reproduced red with identical arms
`[40,160]` — is not covered by this row and is not contradicted by it.

---

## 5. The counter comparison, costed — and it is cheaper than the audit assumed

**The reader already exists and needs zero plumbing.** Measured this pass:

```
GD.REL.require('engine/medicham2-browser.js').seen   ->  607 live counter keys
  flinch  flinchBlockedByInnerFocus  flinchTooLate  flinchPaidHolder
  sideGuardBlocked  sideGuardPierced  sideGuardChosenVsPriority  sideGuardChosenVsSpread
  protectPierced  shieldRefusalAnnounced  shieldGateAtExecution
  preTurnShieldAnnounced  preTurnShieldRefused  enduredLethalHit  helpingHandBP  counter
```

`MEDSEEN` declares **790 keys** in source and 607 are live on the frozen release. Every leaf in the
brief's ordered list already has an engine-side counter. **Nothing in `engine/` or `tests/` reads
`M.seen` against a Showdown-side count** — confirmed by grep; the only `.seen` hits are unrelated
fields on other objects.

The Showdown side is now **free**: `leafEffectMarkers` already returns `{ev, label}` derived from the
authority, and counting occurrences per log is three lines.

So the cost is not the instrument. It is these four, in order:

1. **A per-game DELTA, not a value.** `MEDSEEN` is a module-level const that accumulates across every
   game in the process — the roster played 617 in one run. Snapshot before/after. ~10 lines, and the
   handle must come from the same `REL.require` so it is the snapshot's module instance.
2. **The PAIRING is the one thing that cannot be derived.** A counter's name is an engine-internal
   choice; nothing in the authority says `sideGuardBlocked` means `-activate|move: Quick Guard`. It
   needs a declared table with a written reason per row, the same shape as
   `data/million-targets.json`'s `from` field.
3. **Each pair is a SEMANTIC claim and needs its own fixture.** A counter and a protocol line do not
   necessarily count the same event — a spread move refused by two guarded slots may print twice for
   one internal block. So the tolerance is not "equal"; each pair needs a knob-cleared control proving
   it counts the same thing, exactly like a census row. **Roughly one probe per pair, seven pairs on
   the brief's ordered list.**
4. **One structural blocker, cheap to clear.** `leafEffectMarkers` currently lives inside
   `all_mechanics_fire.js`, **which runs on require** — the same reason `engine/faces.js` exists as a
   separate module. A counter probe cannot import it without starting a whole sweep, so it would
   hand-roll a second copy. Extract it to a data-only module first.

**Suggested first instance: the shield family, not flinch.** The brief ordered it that way and the
measurement agrees — the Showdown-side counter for the shields is the code I wrote today, so that pair
is the only one where half the work is already done and already unit-tested.

---

## 6. The two small corrections owed by the audit, both landed

- **`tests/probe_uncompared_leaves.js`'s CLI said "a duration of 1 on 20".** It computed
  `hole.length - boundary`, which folds the 2 self-removed leaves into the duration-1 count. It now
  reads the two arrays separately and prints
  *"a duration of 1 on 18 … A further 2 remove themselves inside their own action (volatile:fling,
  volatile:sparklingaria)"*, matching `engine/coverage.js`. One producer, one spelling.
- **`engine/coverage.js` gained the line the audit specified.** It prints
  `uncomparable leaves w/ a firing writer   23 of 24`, naming `volatile:attract` as the one with no
  firing writer — exactly the audit's figure. *(My first construction used
  `life.gone_at_the_boundary`, which is the duration-1 half only, and gave `21 of 22`. The set is now
  built the same way the ceiling row above it builds it: declared + duration-1 + self-removed.)*
- **A second `coverage.js` row was added:** `move leaves whose EFFECT was exercised`. It reads
  NOT DERIVED today, with the reason printed — *"the moves arm has not been re-run since the effect
  check landed"* — because the published `data/all-mechanics-fire.json` was deliberately not
  overwritten. It self-heals on the next full roster run.

---

## OWED, NOT RUN

1. **The published roster artifact was not regenerated.** The full moves arm was written to
   `data/verification/all-mechanics-fire.leafeffect.json` instead. A `--kind moves --write` run would
   have destroyed the abilities and items rows, since `report.rows` only holds the arms that ran. The
   command that closes it, and the only one that should be used:

   ```
   tools\lownode.cmd engine\all_mechanics_fire.js --kind all --release <current> --write
   ```

   Until then `coverage.js`'s new row reads NOT DERIVED, which is correct rather than broken.

2. **The census pin does not match.** I was given `9446a684709d`; the run printed the census it
   actually read as digest `6e73727d06ce`, 788 rows, *identical to the live census*. The roster does
   not consume the census directly — it steers the driver's sample selection — so this did not affect
   the result, but the two ids were not reconciled.

3. **`leafEffectMarkers` is trapped in a module that runs on require.** It should move to a data-only
   module before anything else imports it, or the counter comparison will hand-roll a second copy. That
   is `buildMon("Scizor")` waiting to happen.

4. **Three rows are announcement-only for want of a table entry, not for want of a mechanism.**
   `substitute`, `shedtail` and `psychicterrain` need a same-turn adversary in `THEN_WHAT`. Left out
   deliberately — their leaves are board-comparable and are outside the 24 this brief is about.

5. **Endure cannot be checked at this HP pool.** The x6 multiplier exists so nothing faints and no
   forced switch manufactures a divergence. A lethal hit needs the real pool, which is the `real-pool`
   rung's board — but the ladder stops before it because Endure resolves on `bare`. Reaching it means
   letting a row that is `announcement_only` fall through to `real-pool`, which the new stop rule
   already permits; it did not, because `shapeUnbuildable` is decided per rung and `real-pool`'s x2
   pool is still not lethal against a Feraligatr's Facade. **Not attempted.**

6. **The counter comparison was scoped and not built**, per the brief. §5 above is the costing.

7. **No engine fix was made and none is proposed here.** The only engine-adjacent observation is a
   narration difference visible in the dump — Showdown writes `|-singleturn|p1a: X|move: Protect` where
   medicham2 writes `|-singleturn|p1a: X|Protect` — which the differential does not class as a
   divergence and which is narration, not board material. **Filed, not fixed.**

8. **Nothing was committed and nothing was pushed.** Changed on disk:
   `engine/all_mechanics_fire.js`, `engine/faces.js`, `engine/coverage.js`,
   `tests/probe_uncompared_leaves.js`, plus the two new files under `data/verification/`.

   **Any roster run started after this edit is a DIFFERENT SAMPLE from `data/all-mechanics-fire.json`
   at HEAD** — the ten shield rows now face an attack on their click turn. The 500-row diff above says
   no verdict moved, but the games are not the same games.
