# Scenario build — what landed, what did not, and the one number nobody should misread

2026-08-11 · ENGINE · ROADMAP #155–#160 · release `abe83bf4fd3b`

## Verdict

**113 of the 117 inert roster rows now derive a staging rule, against 64 before.** The four that do
not are DECLARED, not missing: two crit RATES that belong to the million-game run (Merciless, Super
Luck), owner-shelved Pickup, and zero-usage Battle Bond.

    inert rows with a derived staging rule       BEFORE      AFTER
    moves                                        29 of 54    54 of 54
    abilities                                    35 of 63    59 of 63

**The MEDICHAM gate reads OPEN, six of six**, against a release cut from this tree, with the
differential re-run at `--n 20000` and all three roster stages re-run against that same release.

## The one number nobody should misread

**The roster's `94 TESTED of 202 IN SCOPE` has not moved.** `engine/faces.js` and its new `thenWhat`
tables are read by `engine/all_mechanics_fire.js`; they are **not** read by `tests/roster.js`, which is
the instrument that produces that ratio. The derivation, the adversaries and the consequences all
exist and are executed — wiring them into the roster's shape rules is the next pass. Until then the 94
is still the true coverage figure.

## Why the order was forced

`faces` is keyed on the TAG. That is the right design and it is why extending it is cheap. It also
means **a scenario cannot be derived from an entity whose record says `untagged` with `params: {}`** —
there is nothing to key on. Thirty abilities were in that state (`trace` 274 sheet fields, `magician`
265, `frisk` 141, `synchronize` 135, `magicguard` 114, `pickpocket` 104, `moxie` 103) and so were five
moves, whose tags were three PROPERTIES and no mechanic.

So: **tags first, tables second, engine defects third.**

## What the new fixtures exposed in the engine — five defects, all pre-existing

| # | defect | scale |
|---|---|---|
| 155 | `piercesProtect` derived with correct params and **read by nothing** — a name match plus a CATEGORY test, wrong in both directions at once | Stone Edge LEAKED through Protect, Unseen Fist MISSED entirely |
| 156 | `boostsOnKO` keyed on `getBestStat` — Beast Boost's *implementation*, not the mechanic | Moxie `untagged` on 103 fields; went live with **no engine change**, purely by fixing the derivation |
| 157 | Entrainment / Simple Beam / Worry Seed resolved to `{kind:'pass'}` | **939 stored clicks** spent on nothing |
| 157 | Guard Split / Power Split / Speed Swap, same, on `storedStats` | not a stat stage, so no board comparator would have caught it either |
| 159 | Trace **SHOWDOWN-ONLY** | 274 sheet fields, never modelled |

Plus one declaration that had quietly become false: `-zbroken` was declared unemitted because *"Z-moves
do not exist in this format"*. True about Z-moves, false about that line — the champions mod re-uses it
for every pierced Protect.

## Two things that went the right way because they were measured, not reviewed

- **`announcesOnEntry` over-matched at 20** on its first draft (Mold Breaker, Pressure, Unnerve,
  Supreme Overlord, the four Ruin abilities — they all announce on entry and then work through a
  second handler). Narrowed to "`onStart` is the ability's ONLY handler": 3.
- **The draft added a second tag for a mechanic that already had one.** `boostsOnFoeFaint` matched
  Eelevate and Beast Boost, which already carry `boostsOnKO`. The existing rule was widened instead.

## The tags.json regeneration

ROADMAP #65 records this operation as having EATEN Serene Grace and Tinted Lens. It was diffed **by
name, per section**, three times across the pass: **0 removed, 0 params shrank**, 22 entities added,
56 tag lists changed, abilities `untagged` **30 → 0**. A count would not have shown any of it.

## Still owed

1. **The absolute-assertion mode for the 37 abilities with no control body.** The membership is now
   derivable — `refusesCopy` carries Showdown's own `notrace` / `noentrain` / `noreceiver` /
   `failroleplay` / `failskillswap` / `cantsuppress` flags straight off each ability, printed at 34 —
   but the three-part assertion (the forme changed; the stats are the NEW forme's; **the body's own SP
   spread survived**) has no harness.
2. **`tests/roster.js` reading `faces` and `thenWhat`.** See "the one number nobody should misread".
3. **Four consumers now have a derived tag, a derived adversary and a derived consequence waiting**:
   `refusesIndirectDamage` (Magic Guard, 114 fields), `reflectsStatusToSource` (Synchronize, 135),
   `stealsItem` (Magician 265 + Pickpocket 104), `passesItemToAlly` (Symbiosis, 58).

## The numbers

    census                437/437 live -> 444/444 live, 0 missing
    differential          0 of 20,000 (seed 20260804), release abe83bf4fd3b
    roster items          139 TESTED of 148 IN SCOPE   0 DIFFER / 0 DID-NOT-FIRE
    roster abilities       94 TESTED of 202 IN SCOPE   0 DIFFER / 0 DID-NOT-FIRE
    roster moves          427 TESTED of 500 IN SCOPE   0 DIFFER / 0 DID-NOT-FIRE
    MEDICHAM gate         OPEN, six of six
