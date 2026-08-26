# 2026-08-26 — Will's card review, and the tests he asked for

**Filed by the coordinator during the review, not after it.** Will read the rendered cards
(`divergences.html`, 21 cards, release `4174fe78d1ee`, 961 games, cap 12) and called out roots by
mechanism. This records what he found and what he asked to be staged, so the requests survive the
session. **The OWED block at the end is the deliverable.**

## WHAT HIS READ ESTABLISHED — 12 CARDS, FOUR ROOTS

- **Card 1 — Throat Chop.** The `-end` line now lands (fixed 2026-08-24) but the clock ticks at the
  foot of the turn instead of its declared residual position. Per-body clocks generally: only Roost is
  a real step in the walk; six named expiry clocks and every condition-with-a-handler tick in an
  undeclared block below it.
- **Cards 2–5, 7 — Supreme Overlord.** One cause, five cards. Will: *"they need to track the number of
  allies that have fainted on switch in… showdown announces that it loses that when it switches out
  and we do not."* Confirmed: this engine emits **none** of the three lines, and `-activate` is NOT
  `[silent]` — a player sees it. The standing declaration covers only the `fallenundefined` case.
- **Card 8 — faint batching.** Will: *"showdown is showing a perished mon hitting zero, a turn ending,
  and then the mon faints with replacements… i feel like ours is correct but obviously showdown is the
  authority."* Confirmed: `faint()` only queues; the line comes from a sweep at fixed boundaries. Same
  root as his own A3 from 2026-08-22, which predicted it shifts every later line — so other cards may
  be downstream of it.
- **Cards 9, 10 — one ordering family.** Spread-move target order (positional on the authority) and
  replacement order among simultaneous switch-ins (speed, through the standard comparison). Will read
  both off the cards unaided.
- **Cards 11, 12 — Tailwind.** Both of the pair. Closeted by his decision; see the separate
  measurement — DEFINED as a seeded coin flip, and it BURNS A DRAW every residual turn both are up.
- **Cards 13, 15 — the spread-secondary pair.** Will's hypothesis: *"i bet the dice got messed up
  because it was a spread move."* Correct in mechanism. Showdown never burns Excadrill **at all** —
  not a late announcement — and we chip it for burn damage afterwards, so it is board-material. In
  BOTH instances the other target of the same spread **fainted on that hit**. 2 of the 8
  board-material games; the only mechanism with more than one.
- **Card 16 — Telepathy.** Narration: authority says `-activate ability: Telepathy`, we say `-immune`.
- **Card 17 — Protect after sleep.** Will: *"by definition it could not have previously protected."*
  Confirmed: `stall` is a volatile with `duration: 2` that lapses after one idle turn, not a tally.
  Ours counts clicks and resets in a branch a sleeping body never reaches. **134,710 clicks — the
  highest-usage defect on the board, and board-material.**

## A COORDINATOR ERROR, RECORDED

I told him a screen-breaking move shatters screens **before** the type-immunity check. **That is
wrong.** There are two `onTryHit` hooks: the TARGET's effects run at step 1 (Telepathy), but the
MOVE's own handler runs via `singleEvent` inside `moveHit` at step 7 — after immunity at step 2. So
Psychic Fangs into a Dark-type fails and the screens **survive**. Will questioned it, which is the
only reason it was caught before he acted on it in a game.

## THE UNREAD GATE — 6 MOVES, 1,365 USES

`data/tags.json` derives an `immunityGate` for six moves, machine-readable, with the hook, the
condition, the announced line and the step. **`engine/medicham2-browser.js` reads it zero times.**
Leech Seed 598, Trick 501, Endeavor 133, Worry Seed 114, Switcheroo 17, Attract 2. Switcheroo is
already on the failing mechanics clause. On Endeavor we emit a `-damage` line at unchanged HP — an
event describing something that did not happen — where the authority refuses the move as an immunity.

## OWED, NOT RUN — THE TESTS WILL ASKED FOR

```bash
# 1. SPICY SPRAY / Scovillain-Mega. Staged in the roster (FIRED-AND-BOARDS-MATCH) but NOT in the
#    census, and the roster compares BOARDS so it cannot see the missing `-immune`. The ability is
#    NOT contact-gated: onDamagingHit with no contact check, so a special hit from range triggers it.
#    The `-immune` line is emitted only when the burn failed AND the attacker has no status AND the
#    attacker is Fire — and it names the ATTACKER, not the mega.
#    Stage four arms: Fire attacker unstatused / Fire attacker already statused / non-Fire attacker /
#    a NON-CONTACT special attack (the control that catches a contact-only implementation).

# 2. SCREENS THROUGH AN IMMUNE TARGET — Psychic Fangs and Brick Break, all three screens.
#    Derived: the move's own onTryHit runs at step 7, AFTER type immunity at step 2, so an immune
#    target means the screens SURVIVE. Arms: immune target (screens survive), Protect up (Protect is
#    step 5, before the hit loop — screens survive), normal hit (screens break) as the control.

# 3. TELEPATHY WORDING — 5 legal carriers (Gardevoir, Medicham, Musharna, Noivern, Oranguru).
#    Arms: ally spread damaging move -> `-activate`; ally STATUS move -> must NOT be blocked (the
#    naive implementation gets this wrong); the same move from a FOE -> must not be blocked.

# 4. PSYCH UP ACROSS A SPEED GAP — Will, 2026-08-26: "a fast delphox clicks nasty plot and a slow
#    psych up user targets it to make sure the stats change works." Delphox is legal, Fire/Psychic,
#    base 104 Speed; Psych Up and Nasty Plot are both legal in the format.
#    VERIFY THE LEARNSETS FIRST (HoopaDex Champions learnsets) — do not assume Delphox has Nasty Plot,
#    and pick the slow copier from legal Psych Up users rather than from memory.
#    The control that makes it non-vacuous: the SAME board with the copier moving FIRST, which must
#    copy nothing. A test where both orders pass is asking nothing.
```

---

## ADDENDUM — MORE OF WILL'S CARD READ, AND TWO MORE TEST REQUESTS

**Card 18 — a charge move's strike is LOST, not merely reordered.** Lead-in: Scovillain Protects,
Dragapult charges Phantom Force. Showdown then has Metagross take super-effective damage and faint;
we have Metagross click Gravity and fail. **So the strike never happens in our game at all** and the
target survives to act. Will's hypothesis was the semi-invulnerable charge phase, and it fits: on the
strike turn the move is FORCED by the lock rather than chosen, so an engine that treats that turn as a
normal choice, or fails to re-queue the locked move after the vanish, silently drops the attack. Same
signature as the trap defect — nothing refuses, the action is simply absent.

**Card 19 — a stale `lastMove`, not a leftover Disable.** Will guessed Gardevoir was carrying an
unexpired Disable. The authority's gate is narrower: Disable **fails outright when the target has no
`lastMove`**, and `lastMove` is nulled inside `clearVolatile` — i.e. on switch-out (`sim/pokemon.ts:1547`).
So Showdown fails it and attributes the failure to Gengar; we believed Gardevoir's last move was
Protect and disabled that. **Same disease as card 17: we retain per-body state the authority discards.**
Disable also fails on Struggle or a PP-less slot, and SHORTENS ITS OWN DURATION when the target has not
yet acted this turn — so its timer depends on turn order.

**Gravity, asked and derived:** a second Gravity while Gravity is up **just fails**. It does not undo
and does not refresh. `Field#addPseudoWeather` returns false when the effect is present and has no
`onFieldRestart`, and Gravity declares only `onFieldStart` / `onFieldEnd`.

## OWED, NOT RUN — THE CHARGE-MOVE SWEEP (WILL, 2026-08-26)

> *"lets stage all the two turn charge up moves (and if they have weather that makes them 1 like arch
> in rain with electro shot or zard in sun with solarbeam"*

**Ten legal charge moves, derived** (`flags.charge`, filtered to the regulation): Bounce, Dig, Dive,
Electro Shot, Fly, Meteor Beam, Phantom Force, Sky Attack, Solar Beam, Solar Blade.

**Weather short-circuits — only three moves have one:** Solar Beam and Solar Blade skip the charge in
`sunnyday` or `desolateland`; Electro Shot skips it in `raindance` or `primordialsea`. The other seven
never skip.

**TWO THINGS THAT ARE EASY TO GET WRONG AND MUST EACH BE AN ARM:**
1. **The stat boost fires even when the charge is skipped.** Electro Shot boosts SpA +1 and Meteor Beam
   boosts SpA +1 on the charge, and in Electro Shot's case the boost is applied **above** the weather
   check — so in rain it boosts AND fires the same turn. An implementation that ties the boost to
   "we are charging" loses it exactly in the weather case.
2. **`-prepare` is emitted BEFORE the short-circuit**, followed by `[still]` and an `-anim`. So the
   skip is not "no announcement" — it is "announce, then do not wait." A test asserting the absence of
   `-prepare` in sun would be asserting the wrong thing.

```bash
# stage each of the ten: charge turn (semi-invulnerable where applicable), strike turn FORCED by the
# lock, and for the three weather moves both arms — weather present (one turn) and absent (two turns).
# CONTROLS: the same board with the weather removed must take two turns; and the boost assertion must
# hold in BOTH arms for Electro Shot, which is what separates the two implementations.
# Meteor Beam additionally routes through runEvent('ChargeMove') -- the Power-Herb hook -- so check
# whether that path exists here before asserting it does nothing.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-mechanics.js
```
