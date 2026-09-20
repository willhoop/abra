# Copycat's called move — 2026-09-19

ENGINE, isolated worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a5472dff304d19da7`.
LIGHT MODE: named staged rows, single-rule roster runs, probes. No full battery, no lattices, no
`quarantine.js`. `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`; the store and pool were
read from the main tree only through the driver's own defaults (nothing pinned, because nothing here is a
pool measurement).

**Pins.** Release cut in this worktree: **`c1acc2e4b39f`** — 27 files, cut after the last engine edit, and
every roster verdict below was read on it. `data/engine-release.json` restored to its pre-run pointer
(`18773c22878f`) afterwards.

---

## 1. VERDICT FIRST: the brief's diagnosis is REFUTED, and there is a real defect underneath it

The brief, relaying `docs/_reports/2026-09-19-lift-deferrals.md` from the sibling worktree, said
**Copycat's called move is aimed at the wrong target** and asked for a die-address fix.

**The target is not involved.** Played out on the roster's own fixture, the authority's turn-2 Copycat
does not aim anywhere — it writes `|-fail|p2a: Samurott` and calls nothing. What parts is **which move is
copied**, and behind that, **which click the field remembers as the last one**.

---

## 2. The authority's rule, read whole

`Battle#clearActiveMove` (`sim/battle.ts:376-385`):

```ts
clearActiveMove(failed?: boolean) {
  if (this.activeMove) {
    if (!failed) { this.lastMove = this.activeMove; }
    this.activeMove = null; this.activePokemon = null; this.activeTarget = null;
  }
}
```

`failed` is an **argument**, not a verdict on the move. Grepped over the whole of `sim/`, it is passed
`true` at five sites:

| site | what it is |
|---|---|
| `sim/battle-actions.ts:252` | the `BeforeMove` event refused — flinch, sleep, Taunt, Disable, Throat Chop … |
| `sim/battle-actions.ts:258` | a commented-out sanity check — dead code |
| `sim/battle-actions.ts:273` | `beforeMoveCallback` returned true (Focus Punch losing focus) |
| `sim/battle-actions.ts:284` | `cant\|nopp` |
| `sim/battle.ts:2810` | the `residual` action, which is not a move at all |

All four move sites sit **above** the announcement in `runMove`. Every other action ends at `runAction`'s
own bare `this.clearActiveMove()` (`sim/battle.ts:2828`). Therefore **a `-fail`, an `onTry` refusal, a
type immunity and a miss all set `battle.lastMove`.** Champions overrides neither `clearActiveMove` nor
`runAction` (`data/mods/champions/scripts.ts` — grepped, not recalled).

`pokemon.lastMove` is the same story through a different door: `runMove` calls
`pokemon.moveUsed(move, targetLoc)` unconditionally at `:291`, after the PP deduction and before
`useMove`, so the per-body field is set for any move that got past the aborts. This engine already writes
`m._lastMove` at the announcement, so that half was already right.

### The draw point, for the record — because it was the question asked

A called move with no explicit target resolves in `useMoveInner`:

```ts
let target = options?.target;                                     // sim/battle-actions.ts:383
...
targetRelayVar = this.battle.runEvent('ModifyTarget', ...);       // :415
if (target === undefined) target = this.battle.getRandomTarget(pokemon, move);   // :418
```

`getRandomTarget` (`sim/battle.ts:2487-2523`) answers the near-side classes first
(`self`, `all`, `allySide`, `allyTeam`, `adjacentAllyOrSelf` → the user; `adjacentAlly` → `sample` of the
allies), and in a standard double (`activePerHalf === 2`, so the `> 2` branch is skipped) falls to
`pokemon.side.randomFoe()` → `this.battle.sample(this.foes())` (`sim/side.ts:367-371`). `foes()` is
`this.foe.allies()` — the foe side's `active` array in slot order, filtered to `!!hp`. `PRNG#sample` is
`const index = this.random(items.length)` (`sim/prng.ts:132-142`), so the draw is one single-argument
`random(n)` at that instant, before the `|move|` line is emitted.

This engine draws at the same instant, from `midTargetDraw` on the `tgt` stream addressed by the called
move's id and the attacker's slot — ROADMAP #478, already built. Two control arms below prove it follows
the authority.

**Legal callers, derived rather than named** (`data/tags.json`, printed by the probe on every run):
`copycat("lastMove")` and `sleeptalk("ownRandom")`. Magic Bounce also reaches `useMove` but passes an
explicit `{ target: source }`, so it takes no draw; Dancer computes `dancersTargetLoc` itself and goes
through `runMove`; Instruct passes `targetLoc: target.lastMoveTargetLoc`. Scanned over every legal move,
ability, item and condition in Reg M-B — `copycat` and `sleeptalk` are the whole set, plus `magicbounce`
with its explicit target.

---

## 3. What this engine did, and the receipt

`field._pendingLastMove` is committed at the top of the NEXT announcement, which is the right instant
(written at the announcement, the field would already read `copycat` by the time the branch that consumes
it runs). The **gate** on it was wrong:

```js
const _pb = field._pendingLastBy;
const _pOK = !_pb || (_pb._mvRes !== undefined ? _pb._mvRes !== false : _pb._mvResLast !== false);
if (field._pendingLastMove && _pOK) { field._lastMoveAny = field._pendingLastMove; ... }
```

`_mvRes` is Stomping Tantrum's question (ROADMAP #84, `moveThisTurnResult`). It is false on BOTH roads —
the abort and the ran-and-failed — so it cannot tell them apart. The abort road needs no test at this site
at all: every `BeforeMove` refusal, the no-PP road and the `beforeMoveCallback` road `continue` **above**
the announcement, so `_mid` is never set for them and they never reach the commit. That is the authority's
`failed: true` expressed as control flow instead of as a flag, and it is why removing the gate is the
whole fix.

### Measured on the roster's own fixture, release `18773c22878f`, arm `top-tie-first`

Goodra-Hisui + Corviknight against Samurott + Torterra, every idle click a Sleep Talk on an awake body:

```
AUTHORITY   |move|p2a: Samurott|Copycat||[still]
            |-fail|p2a: Samurott
OURS        |move|p2a: samurott|copycat|p2a: samurott
            |move|p2a: samurott|dragonpulse|p1b: Corviknight
            |-damage|p1b: Corviknight|147/173
```

The last move ANNOUNCED before the Copycat was Torterra's Sleep Talk, which fails at its own `onTry`
(`source.status === 'slp'`) and carries `flags: { ... failcopycat: 1 ... }` (`data/moves.ts:16868`) — so
`copycat.onHit`'s `if (move.flags['failcopycat'] ...) return false;` refuses it. This engine skipped that
click, reached back to Goodra-Hisui's Dragon Pulse, and copied THAT. Twenty-six HP off a Corviknight the
authority never touched, which is exactly the four leaves the roster row was carrying.

---

## 4. The fix, the knob and the probe

**`engine/medicham2-browser.js`**, one site:

- the `_pOK` gate is now `!FAILED_MOVE_NOT_LAST || <the old expression>` — i.e. off unless the knob is set;
- `MEDSEEN.lastMoveCommittedAfterFailure` counts every commit the fix newly makes, so a fix that stopped
  biting cannot read like one that works;
- `MEDI_FAILED_MOVE_NOT_LAST=1` restores the gate verbatim and stamps `MEDFAILS.failedMoveNotLastRestored`
  **at load**, added to `DELIBERATE_BREAK` in `tests/test-mechanics.js`.

**`tests/probe_called_move_last_move.js`** — 5 arms, `all 5 arms clear`:

| arm | kind | what it holds |
|---|---|---|
| `failed-idle-blocks-the-copy` | red, `top-tie-first` | the roster fixture rebuilt. Authority `-fail`s; the knob puts `dragonpulse -> p1b` and 26 HP back. Counter 8 clean / 0 knob. |
| `failed-click-is-what-gets-copied` | red, `bottom-tie-first` | the OPPOSITE direction, so the fix cannot be "refuse more": a Dragon Claw refused by type immunity against a pure-Fairy Aromatisse is what the authority COPIES. Clean copies `dragonclaw` (Garchomp to 111/183); the knob reaches back to Garchomp's own Brick Break (149/183). Counter 1 / 0. |
| `successful-last-move` | control | nothing fails; the copy must not move under the knob. |
| `called-attack-target-top` | control, `top-tie-first` | the target draw with `random(m)` pinned to `m - 1`: the authority lands on **p1b**. |
| `called-attack-target-bottom` | control, `bottom-tie-first` | the identical board with the pin at `0`: the authority lands on **p1a**. |

The last two are the explicit control on the brief's hypothesis, and the file **asserts the pair is not the
same answer twice** — if both pins produced the same landing slot the arms would clear nothing and the run
fails by name. Printed: `THE TARGET KNOB IS VARIED — authority landings top [p1a,p1b] bottom [p1a,p1a]`.
Both engines follow it, and the `middle` arm (real seeded dice) was checked the same way by hand.

The probe types no expectation: every arm plays the same script on both engines and compares four counted
facts to EACH OTHER — the `|move|` line as `slot/moveid->slot`, `-damage` as `slot/hp`, `-start` as
`slot/effect`, `-fail`/`-immune` as `kind/slot`. Move names are normalised because the two narrators spell
them differently. Legality of every fixture row is checked against `TeamValidator`'s own `canLearn`, and
the format's own clauses (Sleep Talk's `failcopycat`, Dragon Claw's lack of one, Copycat's refusal,
Fairy's Dragon immunity) are read at run time and the file exits 2 rather than pass if any moved.

**Census row** `move/callsAnotherMove` — "A click that RAN and FAILED is still the last move a caller
reads". Clefable Copycats behind Garchomp's Dragon Claw and Dragonite's failed Sleep Talk; the observable
is the SUM of HP the two foes lose (the copy's own target is a random draw and WHICH foe it hits is a
different mechanic). Arms: control **48**, test **0**, plus an inert arm at **0** so "the foes lost HP"
cannot be the board doing it.

Under `MEDI_FAILED_MOVE_NOT_LAST=1` the row reads **MISSING** with arms `48 / 48` — identical, which is
the defect — and the run **refused to write the census**: `data/mechanics-census.json` md5 is
`52cf1e9046ce7c92671b17982dc87977` before and after the knob run.

---

## 5. Copycat's roster deferral — LIFTED

On `c1acc2e4b39f`:

```
tests/roster.js --stage moves --only copycat --reds --release c1acc2e4b39f
  FIRED-AND-BOARDS-DIFFER 0   DID-NOT-FIRE 0   DEFERRED-BY-OWNER 0
  FIRED-AND-BOARDS-MATCH  1   CONTROL-NOT-QUIET 0   COULD-NOT-STAGE 0
  1 TESTED of 1 IN SCOPE, of 1 total

tests/roster.js --stage moves --rule move/generic-status --reds --release c1acc2e4b39f
  0 DIFFER  0 DID-NOT-FIRE  0 DEFERRED-BY-OWNER  0 CONTROL-NOT-QUIET  0 COULD-NOT-STAGE
  38 TESTED of 38 IN SCOPE, of 38 total
```

**`--reds` has no plant for this rule, by the rule's own design** — `move/generic-status` declares
*"THERE IS NO BREAK, because there is no single mechanism to aim one at — this rule is a bucket"*, and the
run prints `0 of 0 apply exactly once`. So the red demonstration is the knob instead, which is stronger
here: under `MEDI_FAILED_MOVE_NOT_LAST=1` the row returns to **`FIRED-AND-BOARDS-DIFFER 1`** carrying
exactly the four leaves it carried before (`p1 party.hp` and `p1b hp`, Corviknight 1384 against 1358,
twice each).

### The shelf's stated reason was wrong twice, and is corrected in place rather than deleted

It said the row fails because *"Showdown refuses `addVolatile` for a volatile already present whose
condition has no `onRestart`, and a failed move never becomes `lastMove`. The fixture idles bodies on
**Focus Energy** ... Underlying verdict: **DID-NOT-FIRE**."*

- The volatile-refusal half landed long ago (`volRefusesRestart`).
- The fixture does **not** idle on Focus Energy. `controlClick()` substitutes **Sleep Talk** for these
  bodies and the run prints it: `3 substituted: Sleep Talk`.
- "A failed move never becomes `lastMove`" is the rule **backwards** — §2 above.
- The verdict was **FIRED-AND-BOARDS-DIFFER**, not DID-NOT-FIRE, by the time it was read.

Will's 2026-08-10 shelf ("PUT COPYCAT INTO THE QUARANTINE IM NOT TOUCHING THAT") is kept as history in
`tests/roster.js` with all four corrections beside it, because a shelf whose reason is false is worse than
a shelf.

---

## 6. Census

`970 live / 0 missing / 970 probed` → **`971 live / 0 missing / 971 probed`**, 0 hollow, 0 threw, 0 unarmed.
The single new row is `move/callsAnotherMove` — "A click that RAN and FAILED is still the last move a
caller reads". (Baseline is this worktree's, at `dec05b65`; the sibling worktree independently reached 971
with a different row — the two are not the same 971 and must not be added.)

---

## 7. Files changed (all inside this worktree)

| file | what |
|---|---|
| `engine/medicham2-browser.js` | the `_pOK` gate at the pending-commit site is now knob-only; `MEDSEEN.lastMoveCommittedAfterFailure`; `MEDFAILS.failedMoveNotLastRestored`; knob `MEDI_FAILED_MOVE_NOT_LAST`, stamped at load |
| `tests/probe_called_move_last_move.js` | **new** — 5 arms, 2 red, 3 control, including the two-pin target control |
| `tests/test-mechanics.js` | census row `callsAnotherMove`; `failedMoveNotLastRestored` added to `DELIBERATE_BREAK` |
| `tests/roster.js` | `copycat` off the `DEFERRED` closet; the shelf's four wrong claims corrected in place as history |
| `data/mechanics-census.json` | regenerated, 971 |
| `docs/ENGINE.md` | this pass's section and the hand list |
| `data/provenance-stamp.json` | touched by a run, not edited |

Not touched: `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`, `engine/board.js`,
`engine/magnemite.js`, `data/engine-data.js`. No `status.js --write`. No commit, no push.

---

## PROPOSED NOTES ROW

```
### 2026-09-19 — ENGINE: a click that RAN and failed is still the last move a caller reads; Copycat leaves the roster closet

**What changed.** `clearActiveMove(failed)` skips the `lastMove` write only when `failed` is passed TRUE,
and over the whole of `sim/` that happens at four sites inside `runMove` — all ABOVE the announcement — plus
the residual (sim/battle-actions.ts:252/258/273/284, sim/battle.ts:2810). Everything else ends at
`runAction`'s bare `this.clearActiveMove()` (sim/battle.ts:2828), so a `-fail`, an `onTry` refusal, a type
immunity and a miss ALL set `battle.lastMove`. This engine gated its own commit on `_mvRes` — Stomping
Tantrum's `moveThisTurnResult`, which is false on both roads and cannot tell them apart — so Copycat reached
back past any failed click. The gate is now knob-only; the abort road never reaches the site, because every
BeforeMove refusal `continue`s above the announcement.

**The figures.** Mechanics census `970 live / 970 probed` → **`971 live / 971 probed`, 0 missing, 0 hollow**
(`data/mechanics-census.json`). Deliberate roster on release `c1acc2e4b39f`: `--only copycat --reds` reads
**FIRED-AND-BOARDS-MATCH 1, DIFFER 0, DEFERRED-BY-OWNER 0**, and the whole `move/generic-status` rule reads
**38 of 38 TESTED, 0 DIFFER, 0 DID-NOT-FIRE, 0 DEFERRED, 0 COULD-NOT-STAGE**. Under
`MEDI_FAILED_MOVE_NOT_LAST=1` the row returns to `FIRED-AND-BOARDS-DIFFER 1` with the same four leaves, and
the census row reads MISSING with both arms at 48 while the run refuses to write the artifact.

**Supersedes.** The DEFERRED-BY-OWNER count in `tests/roster.js`, which loses Copycat. And ~~the shelf's
stated reason — *"Showdown refuses `addVolatile` ... and a failed move never becomes `lastMove`. The fixture
idles bodies on Focus Energy ... Underlying verdict: DID-NOT-FIRE"*~~ — every clause of which is false: the
volatile refusal landed long ago, the fixture idles on SLEEP TALK (the run prints it), the `lastMove` rule is
backwards, and the verdict was FIRED-AND-BOARDS-DIFFER.

**Refuted, not fixed.** The briefed diagnosis that the called move is aimed at the wrong foe. Two control
arms play the identical called attack on the two corner pins — `random(m)` at `m - 1` and at `0` — where the
authority lands on p1b and then on p1a, and both engines follow it; the probe FAILS if the two pins give the
same landing slot, so the knob is varied.

**Still withheld.** A re-clicked crit-stage volatile (Focus Energy, Dragon Cheer) is refused silently here —
`critVolRestartRefused` fires but neither the authority's `|-fail|` nor its `[still]` is written. Board leaves
are identical, so it is narration; measured, not fixed, and it has no probe.

**Basis.** unchanged.

**Owed to.** `docs/ENGINE.md`.
```

---

## OWED, NOT RUN

- **The full roster stages.** Only `--only copycat` and `--rule move/generic-status` were run, per LIGHT
  MODE. The abilities and items stages have not been run on `c1acc2e4b39f` at all, and the moves stage was
  not run end to end — so the claim "nothing else moved" is **not made**. What supports it and is not a
  measurement: the change is one gate at one site, and the whole `move/generic-status` rule (38 rows,
  including every other zero-power `onHit` move) is clean on the new bytes.
- **`data/roster.{items,abilities,moves}.json` are STALE against these engine bytes**, and
  `node engine/status.js` says so by name — three `MEASURED AGAINST A DIFFERENT ENGINE` FAILs, plus the
  mechanics clause for the same reason. Regenerating them is a full battery, which LIGHT MODE forbids.
- **`engine/quarantine.js`.** Not run. Whether the gate is still open is unmeasured from here.
- **The whole-game differential and the three lattices.** Not run. **Stated before any such run**, per
  CLAUDE.md's ranking rule: Copycat is 78 clicks in the corpus and the defect needs a FAILED click
  immediately before one, so the expectation is that **the lab moves and the pinned pool does not**. Anyone
  who runs it should say so first rather than explain it afterwards.
- **The silent crit-stage volatile restart.** Measured above (`critVolRestartRefused` 1, no `-fail`, no
  `[still]`), narration-only by the boards, **not fixed and it has no probe**. It is a different class from
  this batch — arm 2 of the probe was re-staged onto a type-immunity refusal specifically so that somebody
  else's defect is not sitting inside this one's evidence. Routes to ENGINE.
- **A second suspicion, NOT measured and therefore not a finding.** The commit site sits below one
  `continue` — the non-attack semi-invulnerability miss — so a status move that missed a charging body may
  still fail to commit here where the authority commits. No arm stages it, no counter reads it, and nothing
  in this pass moved it either way.
