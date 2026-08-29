# Instruct never asked the shield — ROADMAP #532, closed. 2026-08-29, ENGINE

Batch of one. `shieldRefuses` had thirteen callers; the `instruct` branch was not one of them, and
what came out of that is an **extra action in a turn the authority never gave one to**. Filed and
reproduced red by MEASURE in the previous batch, deliberately not fixed there because other batches
were moving the engine. Fixed here.

**A second, independent board-material defect was found by a failing over-fire control and is FILED
as ROADMAP #534, not fixed.**

---

## The verdict in five lines

| question | answer |
|---|---|
| Does Champions rewrite Instruct? | **No.** 259 moves overridden, Instruct not among them; the only mention under `/data/mods/champions/` is `learnsets.ts:12384`, `instruct: ["9M"]` |
| How many legal moves make another body act? | **One.** Instruct. Twelve others only REORDER an action that already exists |
| The fix | `shieldRefuses(t, a.mv)` is now the `instruct` branch's first question, **above** the Good as Gold check |
| Did the prediction hold? | **Two of three held, one missed** — and the missed one is the finding |
| Board-parted against 92 | **92 -> 91**, protocol **207 -> 205**, one divergence cause removed and none added |

---

## 1. Champions does not rewrite Instruct — checked, not assumed

The brief said to check this specifically, because the Encore batch earlier the same day turned
entirely on the opposite answer: Champions REPLACES a handler mainline leaves alone, so being right
about mainline was being wrong about this game.

```
data/mods/champions/moves.ts    overrides 259 moves    instruct is NOT among them
grep -rn instruct data/mods/champions/    ->  learnsets.ts:12384:   instruct: ["9M"]
```

The probe asks both files on every run and prints
`DOES CHAMPIONS REWRITE INSTRUCT? NO (champions overrides 259 moves)`, so this cannot go stale the
way a hand-maintained list does.

### The handler, read whole (`data/moves.ts:9644-9677`)

```
flags: { protect: 1, bypasssub: 1, allyanim: 1, failinstruct: 1 },   category: "Status",
onHit(target, source) {
  if (!target.lastMove || target.volatiles['dynamax']) return false;
  if (lastMove.flags['failinstruct'] || lastMove.isZ || lastMove.isMax ||
      lastMove.flags['charge'] || lastMove.flags['recharge'] ||
      target.volatiles['beakblast'] || target.volatiles['focuspunch'] ||
      target.volatiles['shelltrap'] || (moveSlot && moveSlot.pp <= 0)) return false;
  this.add('-singleturn', target, 'move: Instruct', `[of] ${source}`);
  this.queue.prioritizeAction(this.queue.resolveAction({ choice: 'move', pokemon: target,
    moveid: target.lastMove.id, targetLoc: target.lastMoveTargetLoc }));
}
```

### The shield is a separate question from that list, and it is asked first

`move.flags['protect']` is 1 and `category` is Status, so `checkMoveBypassesProtect`
(`sim/battle.ts:1300-1302`) answers with its default `blockStatus = true` and returns false;
`protect.condition.onTryHit` writes `|-activate|TARGET|move: Protect` and returns `NOT_FAIL`. That is
`hitStepTryHitEvent` — **step 2 of eight** — and `onHit` lives inside the hit loop. So on a shielded
target **not one member of Instruct's own refusal list is ever consulted.** The two facts were
established separately because they are separately observable, and a fix that conflated them would
have passed the King's Shield control by luck.

### And the shield outranks Good as Gold

Both answer in the same `TryHit` event. `protect.condition` declares `onTryHitPriority: 3`; the
ability declares no priority. The shield's handler runs first and its `NOT_FAIL` (`''`, falsy) breaks
the event. A Gholdengo behind its own Protect reads `|-activate|move: Protect`, never `|-immune`.
**That is a red arm here, not a paragraph.**

---

## 2. How many legal moves make another body act — DERIVED on every run

Derived from the handlers themselves with the Champions mod overlaid, filtered
`exists && !isNonstandard && tier !== 'Illegal'`, so a later addition is picked up with no edit. The
probe **exits 2** if this population ever stops being Instruct alone.

| what it does | count | which |
|---|---|---|
| builds a **NEW** action for another body (`resolveAction({choice:'move', pokemon: target})`) | **1** | **Instruct** — carries `flags.protect`, so a shield can refuse it |
| only **REORDERS** an action that already exists | 12 | After You (**no `protect` flag at all**), Disable, Encore (Champions overrides it), Gravity, Helping Hand, Payback, Quash, Round, Smack Down, Sucker Punch, Taunt, Upper Hand |

Two things worth carrying forward, both derived rather than recalled:

- **After You carries no `protect` flag**, so a shield cannot reach it — which is why the engine's
  `reorder` branch gates its own shield ask on `_isFoe` and Quash is the only member a shield can
  touch. That is consistent and was left alone.
- **Dancer** is the ability-side analogue (a body acts outside its own action). It is
  `// implemented in runMove in scripts.js`, and Champions overrides `scripts.ts`. **Out of scope
  here and not examined** — reported, not claimed.

---

## 3. The fix

```js
/* ROADMAP #532 — THE SHIELD, ABOVE EVERYTHING ELSE IN THIS BRANCH. */
if(t&&!INSTRUCT_NO_SHIELD&&shieldRefuses(t,a.mv)){
  MEDSEEN.instructRefusedByShield++;
  shieldRefusalAnnounce(t);
  continue;
}
```

Four decisions, each with its reason and its control:

| decision | why | what would have caught the alternative |
|---|---|---|
| **above** the Good as Gold check | `onTryHitPriority: 3` against none | `instruct-foe-goodasgold-protect` (red) |
| `shieldRefuses`, not `t.protect` | that is where `shieldsUser.blocksStatus` is read | `instruct-foe-kingsshield` (control) |
| **no `_isFoe` gate** | `checkMoveBypassesProtect` never looks at sides; gating would encode the FIXTURE's limit into the ENGINE | nothing — the ally door is OWED, below |
| does **not** read `MEDI_SHIELD_REFUSAL_UNANNOUNCED` | that knob restores seven sites *each in its own old shape*; this site had no old shape | — |

New counter `MEDSEEN.instructRefusedByShield`. Revert knob `MEDI_INSTRUCT_NO_SHIELD=1`, stamped at
load time in `MEDFAILS.instructNoShieldRestored`.

---

## 4. The probe: 5 arms / 3 red -> 13 arms / 0 failing

**Extended, not replaced.** Every arm now plays **twice** — clean and under the knob — so a red arm
*agrees clean and PARTS under the knob*, which is a stronger claim than the old "expected to part
today". 5 red, 7 control, 1 declared KNOWN-OPEN.

### Red arms (5)

| arm | what it separates |
|---|---|
| `instruct-foe-protect` | 149,746 uses, the shield everybody clicks |
| `instruct-foe-spikyshield` | 2,103 — so the rule is not about the move `protect` |
| `instruct-foe-banefulbunker` | 1,746 — its payload cannot fire against a Status move |
| `instruct-foe-detect` **(new)** | 5,554 — completes all four `blocksStatus: true` members |
| `instruct-foe-goodasgold-protect` **(new)** | **the ORDER.** The one arm that qualifies for two refusals on purpose, because which one is announced IS the question. Under the knob it parts with repeat **0**, which is why `repKnob` is declared per arm rather than assumed to be 1 on every red |

### Controls (7) — every one a way the new caller could over-fire

| arm | the over-fire it rules out |
|---|---|
| `instruct-foe-kingsshield` | the one `blocksStatus === false` member. A fix keyed on `t.protect` passes all five reds and BREAKS this |
| `instruct-foe-noshield` | the shield cleared explicitly; repeat asserted at exactly 1, so "refuse every Instruct" fails |
| `instruct-foe-goodasgold-noshield` **(new)** | the same body with the shield removed. `instructRefusedByShield` must read **0** — an engine that started attributing the ability refusal to the shield would still agree on the protocol line and is caught only by the counter |
| `instruct-foe-shield-expired` **(new)** | two turns. A `mon.protect` surviving the boundary would refuse a repeat the authority grants. The only arm here on a board that is not turn 1 |
| `instruct-foe-endure` **(new)** | `stallingMove: true`, shares protect's `onPrepareHit` byte for byte, blocks nothing (#178 took it out of `shieldsUser`). A fix keyed on the stalling family over-fires here |
| `instruct-foe-nolastmove` **(new)** | the other refusal inside `onHit`. Reuniclus base 30 against Oranguru base 60, so the target has not moved when Instruct resolves |
| `instruct-foe-damaging-repeat` **(new)** | the repeat that actually costs HP — Dazzling Gleam, a spread move (see §6) |

### What is asserted beyond "the streams agree"

- **Both counters at EXACT per-arm equality, on BOTH loads.** `instructRepeat` and
  `instructRefusedByShield`. "It agreed" can never be read off a branch that never ran, and the knob
  run must show the refusal at **0** everywhere — that is the revert being a revert.
- **A `MEDFAILS` load-time stamp**, absent-clean and present-on-knob, before any verdict is read.
- **`shieldBlocksStatusUnknown` at exact zero**, so the file cannot pass through a silent default —
  `shieldRefuses` treats an unreadable param as blocking.
- **Full fixture legality** re-derived from the format on every run (species, ability slot, learnset,
  item), plus the derived Instruct-user list (**Oranguru, alone**) and the derived extra-action
  population.

```
13 arms staged, 0 failing, 1 KNOWN-OPEN (declared, not counted — ROADMAP #534)   [release 705ead2014b2]
```

### One fixture choice worth recording

`instruct-foe-endure` grants the repeat, and the repeat is a **second Endure** — which would normally
draw a stall die and put a roll inside a control. It does not, and the reason is the board rather than
luck: every shield here is +4 and Instruct is priority 0, so **Instruct is the last action of the
turn**, `willAct()` is false, and the authority refuses the second Endure with no die on either side.
Stated in the arm rather than discovered afterwards.

---

## 5. The prediction, stated before the run

Per CLAUDE.md's rank-by-the-pinned-pool rule, all three were written down first.

| prediction | outcome |
|---|---|
| **Census** unmoved at 801 / 801 / 0 — this wires no new tag, it adds a missing caller on `instructsTarget`, already LIVE | **HELD** — 801 live, 801 probed, 0 missing |
| **Pool** board-parted stays at 92 or falls by at most 1 — Instruct is 306 sheet slots and needs a shield standing AND an Instruct into it on the same turn | **HELD** — 92 -> 91 |
| **Lab** 12 counted arms, 0 failing | **MISSED** — one new control parted, and it was not this fix |

---

## 6. The pool moved, and the movement is fully attributed

Release `705ead2014b2` (the current tree) against `#531`'s baseline
`data/verification/game-differential.partingshot531.json` on `124f5aa8c8bd`. **Identical pins**, and
the run's own `baseline_comparability.ok` is `true` rather than assumed: census `9446a684709d`, team
pool `0d103fb9fa87`, pin digest `ccb365985023`, 961 games, cap 12, arm `middle`,
`--steering empirical`, `--end-state`.

| | before | after |
|---|---|---|
| games | 961 | 961 |
| boards never diverged | 869 | **870** |
| **board-parted** | **92** | **91** |
| whole-game protocol divergences | 207 | **205** |
| turn boundaries identical | 10251 / 10565 | 10252 / 10565 |

**Exactly one divergence cause changed, and no new cause appeared:**

```
extra event emitted by medicham2 :: |-activate|p1a|protect <> |-singleturn|p1a|instruct
    before   2 games, 1 board-parted, 1 board-never-parted
    after    absent
```

which accounts for **all** of −2 whole-game and **all** of −1 board-parted. Verified by diffing the
cause tables of the two artifacts, not by reading the headline. The real board is turn 12 of a bo3
ladder game — a Dragonite clicks Protect, an Oranguru Instructs it, and this engine handed the
Dragonite a second action through the shield.

Artifact: `data/verification/game-differential.instructshield532.json`.

**Note on the store, per CLAUDE.md.** The pool was pinned to `data/team-pool-frozen` and the run
reported the same `0d103fb9fa87` the baseline used, so the store moving underneath is ruled out by
measurement rather than by hope. The **live** census digest has moved to `f2353e20a41c` because
`tests/test-mechanics.js` was re-run in this pass; both differential runs were pinned to
`9446a684709d` and neither reads the live one.

---

## 7. The control that failed is the finding — ROADMAP #534, filed and NOT fixed

The new control *"the repeat that actually costs HP"* was first staged with **Psychic aimed at foe
slot 0**. It parted on the clean load **and identically under the revert knob** — same reduced line,
same pair of raw lines — which is what says it is not this batch's change.

```
showdown  |-resisted|p2a: Oranguru|1        then  |-damage|p2a: Oranguru|79/165
medicham  |-activate|p2b: Garchomp|move: Protect
```

The authority builds the repeat with `targetLoc: target.lastMoveTargetLoc` — **the slot the move was
already aimed at**. This engine throws that away and re-runs `targetForMove`, a heuristic best-target
choice, so the second Psychic went into the Garchomp in the *other* slot and ate its Protect.
**Board-material: the damage lands on a different body.**

The splice site's own comment (ROADMAP #223) argues for re-resolution because a pivot can empty the
slot. That reason is real for a slot that has EMPTIED and is not a licence to re-choose one that is
still occupied — so the fix needs an over-fire control on exactly that fallback.

**Why it is filed, not fixed.** It needs a `lastMoveTargetLoc` equivalent recorded wherever
`_lastMove` is written, and `_lastMove` is read by Encore, Copycat, Sleep Talk and the called-move
branch as well. That is a different blast radius from a missing caller, and landing two engine changes
in one batch makes neither attributable.

**How it is carried without becoming a red.** It stays in the instrument as a declared `KNOWN-OPEN`
arm — printed, fully asserted on the shield counters, and excluded from the failure count **only** on
its protocol verdict. The probe **asserts** that it parts identically clean and under the knob, and
fails if that ever stops being true, so the exclusion cannot launder a red this batch caused. The
counted damage control was restaged with **Dazzling Gleam**, a spread move that carries no aim for
the repeat to re-pick.

**#534 has NO `VERIFIED BY`, deliberately** — the same reasoning as #533. The arm is declared and not
counted, so the probe exits 0 while the defect stands; a marker would report GREEN against an open
row, which is the false clearance #533's row is about.

---

## 8. Nothing else went red

| check | result |
|---|---|
| `tests/test-mechanics.js` | 801 live / 0 missing / 801 probed, `run_ok: true` — census regenerated, unmoved |
| `tests/probe_instruct_shield.js` | 13 arms, **0 failing**, 1 KNOWN-OPEN, rc 0 |
| `tests/probe_shield_refusal_line.js` | 13 arms, 0 failing, rc 0 |
| `tests/probe_shield_rearm.js` | all 11 arms clear, rc 0 |
| `tests/test-resolution-order.js` | 26 arms, 1 KNOWN-OPEN, 0 failing, rc 0 |
| `tests/test-engine-diff.js --out data/verification/engine-diff.suite.json` | `disagreed 0`, all three conformance sections clean, rc 0 |
| `tests/test-docs-current.js` | 23 passed, 0 failed |
| `tests/test-roadmap-register.js` | 3 passed, 0 failed |
| `engine/status.js` quarantine gate | **5 of 8 clauses failing, unchanged** — the four stale-artifact clauses were already failing on release `e129bca605e3` before this batch |

None of the four reds MEASURE closed last batch was reintroduced.

---

## OWED, NOT RUN

- **The ALLY door.** `checkMoveBypassesProtect` never looks at sides and an ally-aimed Instruct is the
  commoner board by far. The driver's script format resolves a `normal` move to `foes[t]` on both
  sides, so it is inexpressible and **every arm aims at a foe**. The fix is deliberately ungated, so
  the ally case is handled by the same line the moment a fixture can reach it — but nothing here
  measures it.
- **ROADMAP #534 is open and unrepaired**, and **its pool cost is NOT measured**: no cause of that
  shape appears in either differential artifact, which is one instrument saying nothing rather than
  evidence of zero. The empirical driver does not model the target at all (it aims at the first live
  foe), so the boards where the aim would differ are under-sampled by construction.
- **`engine/register_reality.js` was not run**, so #532's marker verdict is not in
  `data/register-reality.json` and the `no open, known engine defect` clause has not seen this pass.
  It writes that file unconditionally with no `--out`, which the brief forbids. **#532 is now CLOSED
  with a green marker, so the flip MEASURE predicted (5-of-8 to 6-of-8) should no longer happen for
  this row** — that is a prediction about a run nobody has taken, and it is stated as one.
- **The full `tests/run-all.js` suite was not run.** The affected instruments were run individually.
- **No engine release was cut into `data/releases/`.** Every run took the `tests/_live_release.js`
  route, freezing the live tree into a throwaway store under the OS temp directory; `data/releases/`
  and `data/engine-release.json` are untouched. The id `705ead2014b2` is content-derived, so a real
  cut of this tree yields the same id — but **ENGINE still owes the divisions a named cut**, which is
  a publishing act and was not taken here.
- **The stale-artifact clauses were not re-run**: the deliberate roster (items / abilities / moves),
  the published `data/game-differential.json` and `data/all-mechanics-fire.json` all still describe
  release `e129bca605e3`. They were stale before this batch and are staler now; nothing here quotes
  them.
- **The `.pdf` companions were not rebuilt.** `docs/*.pdf` are already weeks stale (newest
  2026-08-04) and nothing gates their freshness — pre-existing, and owed by the living-docs rule.
- **`data/verification/engine-diff.suite.json` was rewritten** by the damage-differential run above.
  It is a verification artifact, not a published one. `data/engine-diff.json` and
  `data/published-samples.json` are untouched.
- **Debris, reported and left**: `data/verification/divergence-turns.empirical.json`,
  `data/verification/gd-empirical-cards.json` and `docs/_reports/2026-08-29-empirical-divergence-cards.md`
  were untracked in the tree at the start of this session and are not mine. Left alone.
