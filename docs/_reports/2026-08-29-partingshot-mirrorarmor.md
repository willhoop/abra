# Parting Shot into Mirror Armor — asked by playing it

2026-08-29, ENGINE. Will's question, verbatim: *"does parting shot into mirror armor send the target
out while the user gets the drops?"*

Everything below was staged in **both** engines on the same turn and read out of the board and both
protocol streams. Nothing here is a recall, and the handler read is cited only as corroboration of a
result that was measured first.

**Instrument:** `tests/probe_partingshot_mirrorarmor.js` (new), which drives `tests/staged_board.js`'s
`harness()` and `engine/game_differential.js`'s `playGame` over a frozen release. It writes no
artifact, runs one process, and did not touch the whole-game differential or its data.

---

## THE ANSWER, PART BY PART

| Will's sub-question | The authority | This engine |
|---|---|---|
| 1. Does the user still switch out? | **YES.** `\|switch\|p1a: Clefable\|…\|[from] Parting Shot` | YES — agrees |
| 2. Who takes the drops, and do both land? | **THE USER.** `-1 Atk` and `-1 SpA`, each preceded by its own `\|-ability\|p2a: Corviknight\|Mirror Armor` | agrees, both stats, both announcements |
| 3. What happens to the target? | **NOTHING.** It keeps its position, takes no drop, and is **not** forced out | agrees |
| 4. Order, and do the drops persist? | Drops land **first**, switch **after** — and `sim/pokemon.ts:1514` `clearVolatile` **resets `this.boosts` to zero**, so the reflected drops are **wiped by the very switch they permitted** | agrees — Incineroar's bench body reads `atk 0 / spa 0` on both engines |
| 5. What if the drop is refused? | **THE USER DOES NOT SWITCH.** Clear Body arm: `\|-fail\|…\|unboost\|[from] ability: Clear Body` and **no `\|switch\|` line at all** — Incineroar is still standing at the boundary | **WRONG — we switch anyway.** ROADMAP #531 |

**In one sentence, for Will:** the target stays exactly where it is, the *user* eats the −1 Attack and
−1 Special Attack, and then the user pivots out — and because switching out clears stat stages, the
drops it just took are erased on the way to the bench. Net result: against Mirror Armor, Parting Shot
is a **free pivot that costs nobody anything**.

**Note on the phrasing.** "Send the target out" reads two ways and both are answered above: the
TARGET's position does not change (nothing forces it out), and the USER's does (it pivots, as normal).

---

## THE MEASUREMENT

Four arms, **two bodies × two abilities**, everything else byte-identical — same clicks, same teams,
same slot. The knob is the target's ability and nothing else.

| arm | target | verdict | authority's `p1a` after the turn | ours |
|---|---|---|---|---|
| `mirror` | Corviknight / Mirror Armor | BOARDS-IDENTICAL | clefable | clefable |
| `plain` | Corviknight / Pressure | BOARDS-IDENTICAL | clefable | clefable |
| `clearbody` | Garganacl / Clear Body | **PARTS** (declared, #531) | **incineroar** | clefable |
| `sturdy` | Garganacl / Sturdy | BOARDS-IDENTICAL | clefable | clefable |

1,204 leaves compared per clean arm, 1,160 on the parting one, over three boundaries each (leads +
two turns). Turn 2 is the negative: nobody clicks Parting Shot, so nothing may be reflected and
nobody may pivot.

**THE KNOB IS PROVED WIRED, NOT ASSUMED.** Identical output across a varied knob is the unwired
signature, so both halves of each pair were read:

- `mirror` puts `atk -1 / spa -1` on **Incineroar**, with `|-ability|…|Mirror Armor` twice;
- `plain`, the **same Corviknight**, puts `atk -1 / spa -1` on **Corviknight** and emits no ability line;
- `clearbody` refuses the drop and refuses the switch; `sturdy`, the **same Garganacl**, takes both.

No arm is inert and no fixture is immune for two reasons: Incineroar runs **Blaze**, not Intimidate
(an entry drop into the same Mirror Armor would have contaminated every boost read); Parting Shot is
`sound` + `bypasssub`, and no arm carries Soundproof, a Substitute or a Protect on the measured turn;
the targets' own click is **Iron Defense**, a self-boost, which both `mirrorarmor` and `clearbody`
ignore by their own `target === source` early return.

### The authority's lines, `mirror` arm, turn 1

```
|move|p1a: Incineroar|Parting Shot|p2a: Corviknight
|-ability|p2a: Corviknight|Mirror Armor
|-unboost|p1a: Incineroar|atk|1
|-ability|p2a: Corviknight|Mirror Armor
|-unboost|p1a: Incineroar|spa|1
|switch|p1a: Clefable|Clefable, L50|170/170|[from] Parting Shot
```

Ours is the same sequence, same order, lower-cased ids.

### Why the board alone could not have answered this

The user switches out on the turn it takes the drop, and `clearVolatile` zeroes `boosts` on the way to
the bench. A turn-boundary board therefore shows **no boosts anywhere** in the `mirror` arm — which
reads exactly like a reflection that never happened. The protocol streams are what distinguish the
two, which is why this probe reads three things per arm rather than one.

*(The brief's premise that "stat BOOSTS are not volatiles, so say what actually happens to them" is
right about the vocabulary and wrong about the consequence: `clearVolatile` clears the boost table
first thing, `sim/pokemon.ts:1514-1523`, before it touches `volatiles` at all.)*

---

## LEGALITY, DERIVED AT RUN TIME AND PRINTED

Read off `engine/champions_sim.js` (`abilityCarriers` / `moveCarriers`, the TeamValidator's own
verdict) on every run of the probe, so a format change surfaces as a refusal rather than as a fixture
that quietly stopped being about this format.

```
legal Mirror Armor carriers : Corviknight
legal Parting Shot carriers : Pangoro, Incineroar, Grimmsnarl, Morpeko, Morpeko-Hangry
legal Clear Body carriers   : Metagross, Dragapult, Garganacl
```

`learnCounters.validatorThrew = 0`. Corviknight is confirmed as the only legal Mirror Armor body.

## THE AUTHORITY'S SOURCE, READ WHOLE

Neither entity is overridden in `/data/mods/champions/` — grepped both `abilities.ts` and `moves.ts`
in the mod directory, zero hits each, so mainline applies.

`data/moves.ts:13168-13188`, the whole block:

```js
onHit(target, source, move) {
    const success = this.boost({ atk: -1, spa: -1 }, target, source);
    if (!success && !target.hasAbility('mirrorarmor')) {
        delete move.selfSwitch;
    }
},
selfSwitch: true,
```

`data/abilities.ts:2647-2669` `mirrorarmor.onTryBoost` deletes each negative entry from the boost
table and re-applies it to `source`, adding `|-ability|` once per stat. Because the entries are
deleted, `this.boost` reports **no** success on the target — which is exactly why the move needs the
`!target.hasAbility('mirrorarmor')` clause to keep pivoting.

**Parting Shot is the only move in the dex that deletes its own `selfSwitch`** — `grep -n "delete
move.selfSwitch" data/moves.ts` returns one hit, line 13180. So this defect has exactly one member
and no family behind it.

---

## DO WE GET IT RIGHT? — YES FOR WILL'S CASE, AND BY ACCIDENT

`engine/medicham2-browser.js:26108`:

```js
if(idx>=0)pivotFrom(a.mv,()=>switchOut(own,idx,bench,foes,sf,field,a.to));
```

There is **no reference to whether the drop above it landed**. The user leaves whatever happened. The
condition Mirror Armor is an exception to is not implemented here, so the exception cannot be
violated — we agree with the authority on Mirror Armor because we agree with it on *everything*.

That makes the answer to Will's question correct today and the mechanic wrong. Filed as **ROADMAP
#531**, with the Clear Body arm DECLARED in the probe so it prints on every run and goes red the day
the fix lands without the declaration being updated.

**NOT FIXED IN THIS PASS, AND THE REASON IS SCHEDULING.** Another ENGINE agent held the
forced-switch mirror (cards A1/A2) in the same window; a second change to the same family would have
made neither attributable — `docs/DIVISIONS.md`'s file-it-do-not-fix rule.

### What it costs, stated honestly

- **Board-material without argument** — the wrong body is standing in the slot, and it stays wrong
  for the rest of the game.
- **Scope:** every refusal *except* Mirror Armor. Clear Body (Metagross, Dragapult, Garganacl), White
  Smoke (Torkoal), and any target already at −6 Attack and −6 Special Attack. In each we hand the
  Parting Shot user a free pivot the authority refuses.
- **Which scoreboard should move:** the LAB, not necessarily the pool. Parting Shot is common; Parting
  Shot *into a boost-refusing ability or a doubly-floored target* is not, so the pinned pool may well
  sit still on a fix. Said before the run, not after.

### Relation to the cards in the brief

- **C1** (Parting Shot ignores Follow Me / Rage Powder) is a *targeting* question and is untouched
  here — this probe aims explicitly at slot 0 and no redirector is on the board.
- **A1/A2** (a pivot that FAILED still switches us out) is **the same sentence as #531**, arrived at
  from the mechanics side rather than from the differential. If the other agent's fix gates the
  switch on the move's result generally, #531 may close with it — in which case this probe reports
  `STALE-ALLOW` and must be updated, which is the point of declaring it rather than deleting it.

---

## CENSUS

Unmoved, and predicted unmoved before the run: **784 live / 784 probed / 0 missing**
(`data/mechanics-census.json`, generated 2026-08-29T02:47:46.690Z). No fix landed, so no row could
move. The census already carries *"Parting Shot switches the user out"* under `pivotStatus` and
carries nothing about the switch being **conditional** — that row is what #531 owes.

The register was searched before the row was filed: no existing row covers this. #289 and #398 are
about Parting Shot's zero-magnitude **announcement** at a cap and are a different site; #259 is about
a pivot skipping the status gates and is closed.

---

## OWED, NOT RUN

Nothing here was run against a re-cut release and no artifact was regenerated, deliberately — the
tree had already moved under the existing artifacts (`status.js` reports them on `e129bca605e3`
against a tree of `87d277c2fe6c`) and another ENGINE agent was live. These are the commands, with the
expected values stated **first**, so a later run can be checked rather than believed.

1. **The probe, unchanged.** Expect `mirror`, `plain`, `sturdy` = `BOARDS-IDENTICAL`; `clearbody` =
   `AS-DECLARED (#531)`; final line `PASS`.
   `SHOWDOWN_PATH=... node tests/probe_partingshot_mirrorarmor.js`

2. **The census, after any fix to #531.** Expect **784 → 785 live / 785 probed / 0 missing**, with a
   new `pivotStatus` row asserting the OUTCOME (which body is standing after the turn) and not the
   classification. Expect the probe above to flip to `STALE-ALLOW` at the same moment, and the
   declaration in `tests/probe_partingshot_mirrorarmor.js` to be deleted in the same pass.
   `SHOWDOWN_PATH=... node tests/test-mechanics.js`

3. **The pinned pool.** Predicted **UNMOVED** — Parting Shot into a boost-refusing ability is rare and
   the pool holds real ladder games. Say the prediction before the run, per the 2026-08-23 ruling.
   `SHOWDOWN_PATH=... node engine/game_differential.js --release <id> --team-store data/team-pool-frozen`
   **NOT RUN HERE ON PURPOSE:** another ENGINE agent held the differential in this window.

4. **The moves roster stage.** Expect the `partingshot` row to move from whatever it reads today to
   `FIRED-AND-BOARDS-MATCH` only after #531 lands.
   `SHOWDOWN_PATH=... node tests/roster.js --stage moves --write`

5. **A second fixture for the same defect, not yet staged.** Parting Shot into a target already at −6
   Attack and −6 Special Attack with an ordinary ability. Predicted to part the same way and for the
   same reason; it is the arm the four-arm design could not express, because reaching −6 inside a
   script means six Parting Shots and each of them pivots the user.

## WHAT WAS DELIBERATELY LEFT ALONE

`engine/game_differential.js` and `data/verification/game-differential.*` were not touched and no
whole-game run was started. `engine/board.js`, `engine/magnemite.js` and `data/engine-data.js` were
not edited. No fit and no self-play. No commit and no push.
