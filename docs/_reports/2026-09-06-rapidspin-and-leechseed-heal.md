# Rapid Spin's four clauses, and whether Leech Seed's heal was ever asserted — 2026-09-06

Two direct questions from Will, answered with measurements. Every Pokémon value below is DERIVED
from `Dex.forFormat('gen9championsvgc2026regmb')` or cited to the line it was read on.

---

## Q1 — "have we tested Rapid Spin getting rid of hazards and things like Leech Seed?"

### What Rapid Spin actually is, in this format

`node engine/mod_audit.js` → `data/mod-audit.json`: rapidspin's **only** Champions difference from
mainline is `pp 40 -> 20`. `mortalspin`, `defog`, `tidyup`, `leechseed`, `spikes`, `stealthrock`,
`stickyweb`, `toxicspikes`, `ceaselessedge` and `stoneaxe` are **identical to mainline** — no entry in
the diff at all. So the handler below IS the Champions handler.

`shortDesc: "Free user from hazards/bind/Leech Seed; +1 Spe."`, `basePower 50`, `accuracy 100`,
`Physical`, `Normal`, `target: normal`, `flags {contact, protect, mirror, metronome}`.
`onAfterHit` / `onAfterSubDamage`, statement by statement:

| clause | exists? | detail |
|---|---|---|
| **1. own Leech Seed** | YES | `pokemon.removeVolatile("leechseed")` → `-end \| <user> \| Leech Seed \| [from] move: Rapid Spin \| [of] <user>` |
| **2. own side's hazards** | YES | `spikes, toxicspikes, stealthrock, stickyweb, gmaxsteelsurge` off `pokemon.side` ONLY. `gmaxsteelsurge` is unreachable — no legal move in Reg M-B lays it |
| **3. own partial trap** | YES | `removeVolatile("partiallytrapped")`; the LINE comes from the condition's own `onEnd`, `-end \| <user> \| <Move> \| [partiallytrapped]`, bare |
| **4. +1 Speed** | YES | a 100% `secondary.self.boosts {spe: 1}` — a secondary, not a self-field, so Sheer Force refuses the whole clause block (`if (!move.hasSheerForce)`) |
| the target's hazards | **NO** | it is `pokemon.side`, not `target.side`. Rapid Spin never touches the far side |
| the target's Leech Seed | **NO** | `pokemon`, i.e. the ATTACKER |
| a screen, Safeguard, the terrain | **NO** | those are Defog's, and Defog's screens come off the TARGET's side only |
| `-fail` when it sweeps nothing | **NO** | the sweep's return value is discarded; the move is a 50 BP attack that always lands its damage |

**Everything hangs off `onAfterHit`**, so a Rapid Spin that does not CONNECT sweeps nothing — a
Normal move into a Ghost is the sharp case, and the +1 Speed does not happen either.

### The other legal hazard-side moves, derived

Walked `D.moves.all()` filtered `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`:

- **Lay:** Spikes, Stealth Rock, Sticky Web, Toxic Spikes (`sideCondition`, `target: foeSide`);
  Ceaseless Edge (Spikes on hit), Stone Axe (Stealth Rock on hit).
- **Remove:** Rapid Spin, Mortal Spin, Defog, Tidy Up.
- **Court Change is BANNED here** — `isNonstandard: 'Past'`. It would not have shared the tag anyway;
  it SWAPS the two sides and removes nothing.

### Coverage, clause by clause — the honest answer

| clause | census row | probe asserts a BOARD outcome | in the differential's compared leaf set |
|---|---|---|---|
| hazards off the own side | YES — *"Rapid Spin sweeps MY side and leaves theirs standing"* | YES — a benched Staraptor walks into the swept side and loses **0**, and into the unswept side and loses **>0** | YES |
| own Leech Seed | rode on MORTAL SPIN's arm of *"Tidy Up tidies both sides…; Mortal Spin pulls its own Leech Seed"* — Rapid Spin's own was **not separately asserted** | (via Mortal Spin) | YES (`vol.leechseed`) |
| own partial trap | **NONE. No probe anywhere.** `MEDSEEN.partialTrapSwept` was incremented by the engine and **read by nothing** | **NO** | YES (`vol.trapped` / the party rows) |
| +1 Speed | only by CLASS — `selfBoostSecondary` is probed on Flame Charge | (Flame Charge) | YES (boosts) |

### `engine/board_state.js` — hazards ARE compared, so nothing here is structurally invisible

The hypothesis that a hazard bug could never be board-material is **refuted**:

- `readMedi` builds, per side, `hazards: {stealthrock, spikes, toxicspikes, stickyweb}` off
  `sf.hz.*` (line 1484); `readSD` builds the same four off `sd.sideConditions` (line 1573).
- `compare()` calls `walk(A.hazards, B.hazards, s + '.hazards', ...)` for **both** `p1` and `p2`
  (line 1740). It is a full `walk`, not a conditional one — no post-faint hold, no `named`-shape
  guard.
- Leech Seed is on the active leaf as `leechseed: m._seededBy ? 1 : 0` (line 981) and on the bench
  row's `vol`.

So the hazard leaves are compared and a hazard bug **would** be board-material. The gap was in the
probes, not in the comparator.

---

## Q2 — "have we tested that Leech Seed actually HEALS the user?"

**Yes, on the BOARD, not only on the protocol line.** Two live census probes assert the sower's HP
rise, and both run with the sower BELOW full HP, so the `if (target.hp >= target.maxhp) return false`
shape the brief warns about does not apply:

1. `tests/test-mechanics.js` — *"Leech Seed pays the seeder at order 8, before the order-10 burn that
   would kill it."* A burned Whimsicott is set to exactly its own burn tick (`me.curHP = chip`), then
   asserted `test.hp === test.drain` where `drain = Math.floor(f1.st.hp / 8)` off the VICTIM. The
   sower ends the turn on exactly the drained amount — chip in, drain in, chip out. That is the
   **arithmetic of the transfer asserted on HP**, not a line.
2. `tests/test-mechanics.js` — *"the Leech Seed drain pays whoever is standing in the SEEDER's slot."*
   `seedPivot` sets `me.curHP = 1` and asserts `ctrl.seeder > ctrl.t1.seeder` (the sower's HP went UP)
   and `test.repl > 1` (the replacement in the slot got it instead).

`tests/probe_leechseed_silent.js` is the protocol half (`[silent]`, and the victim's `-damage`
keeping its `[from] Leech Seed`). It is **not** what carries the heal — the two probes above are, and
they predate it.

The engine's residual (`engine/medicham2-browser.js`, the `_G.has('seed')` block) also already
implements the three things a naive drain gets wrong, each with the authority cited at the site:
conservation on a killing tick (`Math.min(Math.floor(m.st.hp / per), m.curHP)` — heal what was TAKEN),
the cap at the sower's max, Heal Block stopping only the return, and the sower's Big Root modifying
only the return (`healWithSourceMult`). **The heal half was verified, not assumed.**

---

## What was NOT tested, and what got built

### Landed 1 — a census probe for the two unprobed Rapid Spin clauses

`tests/test-mechanics.js`, `probe('move','removesHazards', 'Rapid Spin pulls its OWN Leech Seed and
its OWN partial trap — and a Ghost refuses all of it')`. An Excadrill (a derived legal Rapid Spin
carrier) seeded by a Whimsicott, trapped by a Toxapex's Infestation (derived legal carrier), with
Stealth Rock on its own side. `[own seed, own trap, own rocks, own Speed stage]`:

| arm | reads | must be |
|---|---|---|
| Iron Head (control) | `[1,1,1,0]` | nothing moves |
| Rapid Spin | `[0,0,0,1]` | all three swept, +1 Spe |
| Rapid Spin into a Ghost (Dragapult) | `[1,1,1,0]` | the move cannot hit, so no `onAfterHit`, so nothing at all |

**Shown RED first, per clause independently**, by deleting the clause from the TAG (the only place
the engine reads it from) before medicham2 loads — no repository file edited:

```
KILL=(none)  works=true    control=[1,1,1,0] test=[0,0,0,1] ghost=[1,1,1,0]
KILL=trap    works=false   control=[1,1,1,0] test=[0,1,0,1] ghost=[1,1,1,0]
KILL=seed    works=false   control=[1,1,1,0] test=[1,0,0,1] ghost=[1,1,1,0]
```

### Landed 2 — a real defect: the sweep ran its clauses in its OWN order

**Found by staging Rapid Spin in the official simulator and in medicham2 on the identical board.**
The three carriers have three DIFFERENT orders and this engine had one fixed order for all of them.

Authority (observed, not reasoned):

```
|-end|p1a: Excadrill|Leech Seed|[from] move: Rapid Spin|[of] p1a: Excadrill
|-sideend|p1: A|Stealth Rock|[from] move: Rapid Spin|[of] p1a: Excadrill
|-end|p1a: Excadrill|Infestation|[partiallytrapped]

|-sideend|p2: B|Reflect
|-sideend|p2: B|Stealth Rock|[from] move: Defog|[of] p1a: Corviknight
|-sideend|p1: A|Stealth Rock|[from] move: Defog|[of] p1a: Corviknight

|-end|p1a: Maushold|Substitute
|-sideend|p1: A|Stealth Rock
|-sideend|p2: B|Stealth Rock
```

medicham2 before the fix — `sweepField` ran `hazards -> screens -> terrain -> leechseed -> trap ->
substitutes`, so the spin family wrote its `-sideend` ABOVE its Leech Seed `-end`, Defog wrote its own
side before the target's and its screen last, and Tidy Up wrote its Substitute `-end` BELOW both side
lines. The BOARD is identical either way — which is exactly why three board probes sat green over it.

Fixed to `substitutes -> leechseed -> screens -> hazards -> terrain -> trap`, with the hazard bag
order leading with the TARGET's side when the tag says the screens come off the target
(`screensFrom === 'target'`). Every step is gated on a param already in `data/tags.json`; **no move is
named** and no tag regeneration was needed. Restore knob `MEDI_SWEEP_LEGACY_ORDER=1`, counters
`MEDSEEN.sweepInAuthorityOrder` and `MEDFAILS.sweepLegacyOrderRestored`.

`tests/probe_hazard_sweep_order.js` — derives the family off `data/tags.json`, FAILS BY NAME if a
carrier has a clause shape no arm stages, plays each shape in BOTH engines and asserts the
`(event, subject, effect)` SEQUENCE agrees. Green; the parent re-runs itself under the knob and
**all three arms go red**:

```
child exit 1, 3 FAIL line(s):
  FAIL  SPIN (seed, own hazards, trap): the sequence agrees
  FAIL  DEFOG (target screens, target hazards, own hazards): the sequence agrees
  FAIL  TIDY UP (every doll, own hazards, foe hazards): the sequence agrees
```

Control: the same Excadrill clicking a non-sweeping move writes **no** `-end`/`-sideend` in either
engine. Counters: `hazardSwept` moved by 5, `sweepInAuthorityOrder` by 3.

---

## Measured, with all three pins

| | |
|---|---|
| release BEFORE | `d9e551ed0d5a` |
| release AFTER | `57679ef9a4a3` |
| census pin | `data/verification/census-pin-9446a684709d.json` (both) |
| team store | `data/team-pool-frozen` (both) |
| arm / driver | `middle`, `--steering empirical` (both) |

Matched pair, same command, only `--release` differs. **Both runs: 777 games, 98 diverged, 2 threw.**
The two logs are byte-identical apart from the release id and a pool-cache rebuild note (17 diff
lines, all of them the id or the cache message).

**The pool did not move, and that was called before the run.** Occurrences on the frozen pool's
sheets: **Rapid Spin 0**, Mortal Spin 47, Defog 51, Tidy Up 13. Will's exact question is about a move
the pinned ladder pool **never contains**. This is the lab-vs-pool split: the census moved
**829 → 830** and the new order probe is green with its knob red; the pool is flat by construction.

*(Note on the headline: these runs read 777 games where the published `data/game-differential.json`
reads 961 — the frozen pool's cache was rebuilt on the first run and the draw is smaller. The BEFORE
and AFTER above are a matched pair against each other and are the valid comparison. I did **not**
`--write`, so the published artifact is untouched and its 27/961 / 93 / 70 figures are unchanged and
uncompared.)*

`node engine/status.js` — **830/830 probed mechanics live, 0 missing.** Nothing went down.
`tests/test-engine-diff.js` exits 3 before and after my change (verified by stashing) — pre-existing,
not caused here.

---

## Owed, named, not fixed

- **The `[from] move: <Move>` attribution on a swept line.** The authority attributes the spin
  family's and Defog's `-sideend`/`-end` and leaves Tidy Up's **bare**; this engine attributes none.
  No param in `data/tags.json` can tell the two apart — the discriminator is a HANDLER fact and needs
  a derived `removesHazards` param, which needs `engine/tag_dex.js`, which **exhausts the heap**
  (reproduced this session: `Reached heap limit`, `data/tags.json` untouched). That blocker is
  already on ENGINE's hand list. `probe_hazard_sweep_order.js` PRINTS the gap (4 arms) rather than
  asserting it.
- **The `-sidestart` / `-sideend` effect LABEL is not uniform upstream and this engine writes
  `move: <id>` for all of it.** Derived from the conditions themselves: `Reflect`, `Safeguard`,
  `Mist` and `Spikes` announce a BARE name; `Light Screen`, `Aurora Veil`, `Tailwind`, `Stealth
  Rock`, `Sticky Web`, `Toxic Spikes`, `Lucky Chant` announce `move: NAME`; Safeguard's and
  Tailwind's `-sidestart` carry a further `[persistent]` field this engine does not write. The
  differential's own `effect-namespace` equivalence collapses the first half, so only `[persistent]`
  is instrument-visible. `sideBuff` already carries `startsAs` for exactly this reason; `hazard` and
  `halvesDamage` do not — same tag_dex blocker.
- **Rapid Spin's +1 Speed has no probe of its own**, only the `selfBoostSecondary` class probe on
  Flame Charge. It is now asserted incidentally as the fourth slot of the new census probe.
