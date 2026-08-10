# MEDICHAM SPRINT — running notes

**Version 3.96.0 · 2026-08-10**

**WHAT THIS FILE IS AND WHEN IT DIES.** Will, 2026-08-10: *"yes faster, lets just keep a running notes
list doc that we can then use to update the living docs upon completion of medicham."*

The living-docs rule normally moves the white paper, the deck, the technical docs, SUMMARY, MODELS, the
division ledger and CHANGELOG **in the same pass as the code**, with a version bump. For the duration
of the MEDICHAM gate sprint that pass is **deferred, deliberately and on the record** — each fix writes
one row here instead, and the whole batch is written up when the gate closes.

**THE DEFERRAL IS NOT A BYPASS.** `--no-verify` is still banned. The pre-commit gate still runs. What
changed is the target: a sprint commit must touch **this file**, so a fix that records nothing still
fails. The debt is visible and countable rather than silent, which is the whole difference between
this and the four-day drift that made the rule exist.

**WHEN THE GATE CLOSES:** every row below becomes CHANGELOG entries, ledger sections and headline
paragraphs, and this file is deleted. If the sprint is abandoned, the rows still have to be written up
— the debt does not expire because the sprint did.

---

## THE GATE, at sprint start (release `13bda114d649` + the flat-heal cut)

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / abilities  0 differ, 0 did-not-fire, 84 match
FAIL  deliberate roster / items      0 differ, 3 did-not-fire, 137 match
FAIL  deliberate roster / moves     23 differ, 24 did-not-fire, 362 match
```

Census **330 live / 330 probed / 0 missing**. Damage stages **1728/1728 exact**.

**Not counted by the gate and not passing either:** `COULD-NOT-STAGE` is **316 rows** — 217 abilities,
91 moves, 8 items. Each carries a written reason. They are *unmeasured*, not clean.

---

## ROWS CLOSED THIS SPRINT

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 1 | **Iron Ball** | 139 | `speedMult` matched `name === 'choicescarf'`. The CONSUMER worked and was starved. Derived from `onModifySpe` | DID-NOT-FIRE → MATCH |
| 2 | **Light Ball** | 41 | `statMult` matched four names, **all four banned here**, and nothing read the tag; `dmgRange` carried three matching permanently-false conditions. Derived, with the Pikachu lock carried | DID-NOT-FIRE → MATCH |
| 3 | **Oran Berry** | 1 | heals a **flat 10**, not a fraction; the regex read only `maxhp/N`. `restoresFlat` derived beside `restores`, deliberately NOT scaled by max HP | DID-NOT-FIRE → MATCH |
| 4 | **Big Root** | 53 | no tag at all. `healMultBySource` derived from `onTryHeal` — the SOURCE LIST is part of the fact and is carried, so it boosts drain and Leech Seed and nothing else | DID-NOT-FIRE → MATCH |
| 5 | **Shell Bell** | 44 | no tag at all. `healFromDamageDealt` derived; sits beside recoil because both are a fraction of damage ACTUALLY dealt. **Took two passes:** `Math.round` was one high every turn — the authority clamps <=1 to 1 and then TRUNCATES | DID-NOT-FIRE → DIFFER → MATCH |
| 6 | **Metronome** | 19 | **SHELVED BY WILL, not fixed.** Tag derived and correct; the consumer needs a per-body consecutive-use counter threaded through the turn loop and read in `dmgRange` — every move's damage path, for the smallest row in the queue | DID-NOT-FIRE → DEFERRED-BY-OWNER |

**ITEMS CLAUSE CLOSED: 6 open → 0. The gate is now 3 of 4 PASS.**

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / items      139 matched (1 deferred, still staged and printed)
PASS  deliberate roster / abilities  84 matched
FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
```

---

## FINDINGS THAT ARE NOT FIXES

- **THE CLOSET IS NEW MACHINERY AND NEEDS WRITING UP.** `DECLARED` quietens a *difference*; it cannot
  shelve an *absence*, which is what DID-NOT-FIRE is. `DEFERRED` in `tests/roster.js` shelves an ENTITY
  by name, with the owner's quote and the date. A deferred row is **still staged, still played against
  the authority, and still printed every run** — it just stops holding the gate. Deleting the entity
  instead would have made the shelf invisible. **And the shelf is checked:** if the row would now pass
  on its own, `would_pass_now` fires and `engine/quarantine.js` FAILS the stage with *"take the shelf
  down"*. Same discipline as the DECLARED staleness check that once retracted its own author's
  declaration.
- **THREE MORE NAME-HARDCODES OF THE SAME SHAPE, filed and not fixed.** `passiveHeal` matches
  `name === 'leftovers'`; `blocksSecondary` and `blocksPowder` match Covert Cloak and Safety Goggles,
  **both banned in this format**. Same defect as `speedMult` and `statMult` — a producer that can only
  name one member.
- **Three Fling facts checked at Will's prompt and all three were already correct**, so none is queue
  work: Light Ball flings for **paralysis**, Iron Ball for 130 BP and **no flinch**, King's Rock for
  **flinch** (96 uses, the only legal item here whose Fling carries a volatile).

---

## STANDING CAVEAT ON EVERY "USES" FIGURE BELOW

ROADMAP #70. Measured 2026-08-10 on Iron Ball: `tags.json` says 139, `g.sheets` (populated on 1.7% of
sides) says 15, `g.sets` says 0. **The queue is ORDERED by these numbers.** Every usage figure in this
file inherits that uncertainty and is quoted from `tags.json` unless stated otherwise.
