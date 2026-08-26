# 2026-08-26 — The MEDICHAM priority list, from Will's 21-card review

**Source:** Will read all 21 rendered cards (`divergences.html`, release `4174fe78d1ee`, 961 games,
cap 12) plus the staging he asked for during the read. Ranked by the coordinator. **Ranking rule:
board-material and high-usage first, then roots that collapse several cards, then phantom dice, then
narration, then coverage.** Not ranked by card count — 21 cards are ~10 causes.

**A caveat that applies to every figure below:** these games are steered. The driver picks, at every
decision, whatever action reaches the least-exercised census row. Protect is over-represented here
relative to real play. The defect frequencies are real; the *rates* are manufactured.

---

## P0 — RUNNING NOW

**1. Protect must match exactly.** Will: *"protect needs to match showdown perfectly its the most
clicked move in the game spend all your efforts on that."* **Board-material, 134,710 clicks** — an
order of magnitude above anything else on this list.
The defect (card 17): the consecutive-use counter is a **volatile with a 2-turn clock**, not a tally.
It starts at 3, triples per use, caps at 729, refreshes its own clock, and **lapses after one idle
turn**. Ours counts clicks and resets in a branch a sleeping body never reaches. Will diagnosed it
from the game: *"by definition it could not have previously protected."*
The batch also carries, all requested by Will:
- **Feint** breaking a Protect and **an ally then connecting** — `hitStepBreakProtect` REMOVES the
  volatile, so protection is gone for the rest of the turn.
- **Unseen Fist / Piercing Drill** — byte-identical `onHitProtect` in this format; contact moves
  bypass at **25%**, applied as the FINAL modifier (after Life Orb), emitting **two** lines: one
  naming the ability, one on the target. **The bypass does NOT remove the volatile** — a second
  attacker is still blocked. That is the control separating it from Feint.
- **Phantom Force** breaking a Protect on its strike turn.
- **The variants and their on-block effects** — legal here: Protect, Detect, Baneful Bunker, Spiky
  Shield, King's Shield, plus Quick Guard / Wide Guard. **CORRECTION, 2026-08-26: the coordinator
  wrote here that Quick Guard and Wide Guard do NOT share the counter. They DO** — Wide Guard's
  onHitSide adds stall to the USER, and Quick Guard's handler was read rather than assumed and is
  byte-identical. Measured live: a control leaves the counter at 0; Protect, Wide Guard and Quick
  Guard all leave it at 1 and all cost the same HP. The engine already had this right; only the
  brief was wrong.
  **Banned and forbidden in any fixture: Obstruct, Silk Trap, Burning Bulwark, Max Guard, Crafty
  Shield, Mat Block.**
- The success check is `randomChance(1, counter)` on the **shared die** — match the draw, not just
  the outcome.

---

## P1 — BOARD-MATERIAL ROOTS

**2. The spread-secondary address (cards 13 and 15).** Will's hypothesis, confirmed: *"i bet the dice
got messed up because it was a spread move."* We burn an Excadrill and flinch a Metagross that the
authority never does — **and Showdown's stream never contains the burn at all**, so it is not a late
announcement. We then chip for burn damage they do not. **2 of the 8 board-material games — the only
mechanism with more than one.** In BOTH instances the *other* target of that spread **fainted on the
same hit**, which is the suspected cause: a fainted target skipped for the secondary on one engine
shifts every later roll's address. `tests/test-middle-identity.js` answers whether it is an address
problem **with no fix and no risk** — run it first.

**3. Faint batching (card 8).** `faint()` only queues; the `|faint|` line comes from a sweep at fixed
boundaries. We announce at the moment of lethal damage. Will: *"i feel like ours is correct but
obviously showdown is the authority."* Correct on both counts — and the authority's order is
deliberate, so an action's own consequences finish before deaths are declared.
**Ranked here because it is a MULTIPLIER, not a card.** Will's own 2026-08-22 review predicted it:
*"a faint announced early shifts every line after it, so games currently filed under other classes may
be downstream of it."* Fixing it may collapse several cards at once.

**4. The charge-move strike is LOST, not reordered (card 18).** Showdown's Phantom Force kills
Metagross; ours never fires and Metagross acts instead. On the strike turn the move is FORCED by the
lock rather than chosen — an engine treating that as a normal choice drops the attack silently.
**Same signature as the trap defect: nothing refuses, the action is simply absent.**

---

## P2 — GATES WE CONSULT LATE OR NOT AT ALL

These are one family. Fixing them one card at a time is the mistake.

**5. The unread `immunityGate` — 6 moves, 1,365 uses (card 2).** `data/tags.json` DERIVES the gate for
Leech Seed (598), Trick (501), Endeavor (133), Worry Seed (114), Switcheroo (17), Attract (2) — hook,
condition, announced line, and step — and `medicham2-browser.js` reads it **zero times**. On Endeavor
we emit a `-damage` line at unchanged HP: an event describing something that did not happen. Will:
*"we say 'drops' when in reality nothing happened."* **Switcheroo is already on the failing mechanics
clause.**

**6. Volatile re-application is not refused (cards 19 and 21).** Two status moves the authority
REFUSES and we APPLY. Torment has no failure conditions of its own — its only refusal is that the
target already has it. Disable fails when the target has no `lastMove`, when that move has no PP, or
on Struggle — and it shortens its own duration when the target has not yet acted, so its timer depends
on turn order. **One fix, not two, and it likely covers every move that applies a volatile.**

**7. Type immunity vs semi-invulnerability precedence (card 20).** Same Raichu into the same Golurk
agreed IMMUNE earlier in that game. At the divergence Golurk is mid-Phantom-Force: the authority
reports the **type immunity**, we report the **vanish**. Both gates apply; the engines resolve them in
opposite order. **Needs three arms — vanished+immune, vanished only, immune only** — because tested
separately both engines look right. NOTE: Raichu **does** have megas here (Mega-X Electric Surge,
Mega-Y No Guard); the coordinator initially said otherwise and was wrong.

**8. The phantom-die class — REGISTER AS ONE FAMILY.** Every item here consumes a draw the authority
does not, which shifts every later random event: the accuracy roll on an immune target (7), the
spread-secondary address (2), and Tailwind's tie shuffle, which **burns a draw on every residual turn
both are up**, not merely at expiry. A right outcome with a wrong draw count is still wrong.

---

## P3 — ORDERING AND POSITION

**9. The ordering family (cards 9 and 10).** Will read both off the protocol unaided. Spread-move
targets are assembled **positionally** by the authority (adjacent allies, then adjacent foes) and
never speed-sorted; simultaneous replacements go through the standard comparison and resolve by
**speed**. We produce different sequences over the same members. **Same shape as the mega-queue fix
that landed earlier and moved three games** — one probe should cover both.

**10. Migrate the per-body residual clocks (card 1).** Will: *"i thought we follow the entire residual
order why is at a different time for 1."* We follow it for side, field and terrain effects; exactly
ONE per-body effect (Roost) is a real step in the walk. Six named expiry clocks tick in an undeclared
block below it — Taunt 15, Disable 17, Magnet Rise 18, Heal Block 20, Throat Chop 22, Yawn 23 — and
**that list undercounts**: anything owning a handler AND a duration (Encore, Perish Song, Uproar,
lock-in) cannot appear on it and ticks in the same wrong block.
**Not architecture — a migration.** The list exists, the target positions are derived, one member
already works. The cost is per-effect measurement, because moving a clock changes whether a body is
still standing when the next effect runs.

---

## P4 — NARRATION, AND THE COVERAGE WILL ASKED FOR

**11. Telepathy wording (card 16).** Authority says the ability activates; we say immune. Same board.
Arms: ally spread damaging move → the line fires; **ally STATUS move → must NOT be blocked** (the one
a naive implementation gets wrong); the same move from a foe → not blocked. Five legal carriers.

**12. Spicy Spray's missing `-immune` (card 6).** Staged in the roster and passing — because the
roster compares BOARDS and cannot see a missing line. **NOT in the census.** Two corrections worth
carrying: it is **not contact-gated** (`onDamagingHit` with no contact check, so a ranged special
triggers it), and the `-immune` names the **attacker**, gated on burn-failed AND attacker-unstatused
AND attacker-is-Fire. Fourth arm, the control: **a non-contact special attack.**

**13. Screens through an immune target (Will's request).** **The coordinator got this wrong first and
Will caught it.** The move's own `onTryHit` runs inside `moveHit` at step 7, AFTER type immunity at
step 2 — so Psychic Fangs into a Dark-type fails and **the screens survive**. Arms: immune target
(survive), Protect up (Protect is step 5, before the hit loop — survive), normal hit (break).

**14. Every two-turn charge move (Will's request).** Ten legal: Bounce, Dig, Dive, Electro Shot, Fly,
Meteor Beam, Phantom Force, Sky Attack, Solar Beam, Solar Blade. Weather short-circuits on exactly
three — Solar Beam / Solar Blade in sun, Electro Shot in rain. **Two traps, each its own arm:** the
SpA boost fires **even when the weather skips the charge** (it sits above the weather check), and
`-prepare` is emitted **before** the skip, so asserting its absence would assert the wrong thing.

**15. Psych Up across a speed gap (Will's request).** A fast Delphox boosts, a slow copier takes the
stages. **Verify learnsets first** — do not assume. **Control: the same board with the copier moving
FIRST, which must copy nothing.** A test where both orders pass is asking nothing.

---

## P5 — INSTRUMENTS, WHICH HAVE BEEN WRONG MORE OFTEN THAN THE ENGINE

**16. Raise the card dump's lead-in.** Sixteen lines blocked two of Will's diagnoses tonight — where
Krookodile came from, and what KO'd the body Ninetales replaced. His own review argued for more
CARDS; this is the same argument for more DEPTH. A few hundred bytes per card against an evening of
not being able to finish a read.

**17. The 27 remaining red checks.** Triaged: **20 real defects, 6 broken checks, 2 red by design.**
Named: the two engines are on **different rulebooks** (`data/abra-tags.js` vs its source, and both
carry an identical timestamp so no staleness check can see it); the mutation gate catches **0 of 2**
planted stubs while 1,563 verdicts rest on it; one check reports *"10 capabilities NOT WIRED"* about a
process that **died before printing a line**.

**18. The durable generated-file rule.** Will: *"i just dont want this to ever be an issue again."*
Every generated artifact carries a digest of **its own content** plus the digest of its source, and
ONE check walks all of them. **Not this pair added to a list** — the species-key bug was fixed and
gated twice and the third instance walked past both gates because the ratchet enumerated wrong forms
instead of making the resolver the only door.

**19. Narrow the sample exclusion.** The Illusion closet is over-broad by **17 of 43** — teams dropped
for a body neither engine ever brings. **Raises the denominator**, so it needs its own clean
measurement, and today's 17-of-961 is if anything understated.

**20. `tests/test-resolution-order.js` OOMs at the default heap** and passes with
`--max-old-space-size=4096`. Pre-existing.

---

## CLOSED TONIGHT, RECORDED SO THEY ARE NOT RE-OPENED

- **Supreme Overlord (cards 2–5, 7 — one cause, five cards).** All three narration lines implemented;
  census 706 → 710; whole-game unchanged, as predicted. Will's rounding suspicion was real: the
  computed 10% and the authority's table differ at n=1 and n=3, on **every base power ending in 5**.
  The `fallenundefined` declaration was NOT over-broad — the matcher only ever caught that string.
- **Tailwind (cards 11–12).** Closeted by Will's decision. Measured as **DEFINED**: an exact tie on
  every field, resolved by a seeded coin flip. **But it burns a draw** — see item 8.
- **Gravity re-use, asked and answered:** a second Gravity **just fails**. No undo, no refresh.

## OWED, NOT RUN

```bash
# the no-risk first move on item 2 — answers "address or gate" without changing anything
node tests/test-middle-identity.js

# item 16, then re-render, so the remaining cards answer their own questions
node engine/game_differential.js --games 1200 --arm middle --release <id> \
  --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --dump-games 999 --dump-out data/divergence-turns.json
node engine/divergence_cards.js --in data/divergence-turns.json --out divergences.html

# the replay that answers what KO'd the body Ninetales replaced
node engine/replay_one.js --census data/verification/census-pin-9446a684709d.json

# item 20's workaround until it is fixed
node --max-old-space-size=4096 tests/test-resolution-order.js
```

---

## ADDENDUM, 2026-08-26 — THE MECHANICS CLAUSE IS MEASURING THE WRONG 964 THINGS

**This reorders the list and it is the most important finding of the night after Protect.**

The failing clause reports **10 of 17 diverging mechanics uncleared**, worst row 112 teams. Separately it
excludes **67 mechanics that NEVER FIRED** as "a harness gap, not counted here."

**Those 67 are the most-played mechanics in the format.** Verified by the coordinator directly against
`data/all-mechanics-fire.json` — every one of these carries verdict `DID-NOT-FIRE`:

| mechanic | teams | staged? |
|---|---|---|
| Prankster | 9,313 | **never fires** |
| Hospitality | 6,740 | **never fires** |
| Flower Veil | 4,109 | **never fires** |
| Lightning Rod | 3,326 | **never fires** |
| Unburden | 3,026 | **never fires** |
| Light Clay | 2,798 | **never fires** |

**The worst row on the failing clause is 112 teams.** So the untested set is roughly eighty times more
played than the worst thing the clause is currently chasing. **Driving this clause to zero would say
nothing about the nine most-played mechanics in this format** — it would only say that the ones we
happen to be able to stage agree.

This is the coverage-versus-correctness distinction one level up, and it is exactly the shape of the
2026-07-28 lesson: **a capability that cannot prove it ran is assumed broken.** A mechanic that never
fires is not passing; it is unmeasured, and it is being reported in the same breath as the ones that
pass.

**AND THE CLAUSE'S ARTIFACT IS STALE RIGHT NOW.** `data/all-mechanics-fire.json` ran on release
`419e9636ec6a` at 07:30:28Z; the pointer has since moved to `7fc604e5bc44` and the simulator was
rewritten at 08:07Z. The clause short-circuits to MEASURED AGAINST A DIFFERENT ENGINE today. **The "10
of 17" is true of that release only and must not be quoted as current.**

### THE TEN ARE EIGHT MECHANISMS, AND ONLY ONE FIX CLOSES MORE THAN ONE ROW

1. **The spread hit-step pipeline.** The authority runs each hit STEP across every target before moving
   to the next step, so a Protect refusal always precedes any target's effect; we resolve target by
   target. Closes String Shot, Cotton Spore and Teeter Dance together, plus one whole-game divergence,
   and it is the frame the unread immunity gate needs.
2. **Supreme Overlord: DELETE THE ROW, DO NOT FIX IT.** It heads the list at 112 teams and it is the
   placeholder-string line the whole-game clause **already declares AUTHORITY-WRONG**. The narration fix
   landed before that run; the survivor is the declared case. `classifyMechanics` never consults the
   declared list the whole-game clause applies. **A MEASURE ticket about an instrument, not engine work.**
3. **Shell Side Arm (101 clicks) and Sand Force (34 teams)** — the only two board-material rows. Shell
   Side Arm's category choice has no representation in the tags at all. Sand Force's tag records one
   type where the authority boosts three, and it is the only multi-type damage boost in the file — one
   scalar that should be a list.

**The Switcheroo hypothesis in the earlier brief is REFUTED.** Its divergence is the announcement NAME —
the authority announces it as Trick with an attribution tag, we print the raw id. The unread gate does
own one row, and it is Attract, whose gate is gender, which this engine does not model at all.
